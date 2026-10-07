import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  IAnveshanAnswerRepository,
  IAppFeedbackRepository,
  IQuestionRepository,
  REPOSITORY_TOKENS,
} from '../../shared/database/repositories';
import type { AnveshanAnswer, AnveshanAnswerScore, AnveshanAnswerSource, Question } from '../../shared/database/entities';
import { UserService } from '../user/user.service';
import { AgriEntitiesService } from '../agri-entities/agri-entities.service';
import { QuestionService } from './question.service';
import { AnveshanScoringService } from '../ai/anveshan-scoring.service';
import { SubmitAnveshanAnswerDto } from './dto';
import {
  type AnveshanCounts,
  type AnveshanTimeline,
  countAnveshanAnswers,
  evaluateAnveshanProgress,
  findAnveshanAnswerableQuestions,
  toStepTimeline,
} from '../../shared/utils/anveshan.util';
import {
  ANVESHAN_SCORE_JOB_STALE_AFTER_MS,
  ANVESHAN_SCORE_MISSING_GRACE_MS,
  isAnswerScoringEnabled,
} from '../../shared/constants/anveshan.constant';


export interface AnveshanMilestone {
  requirements: AnveshanCounts;
  progress: AnveshanCounts;
  /** True once the question and crop/weed/pest/disease goals are met, which unlocks answering. */
  submissionsCompleted: boolean;
  /** True once every goal, including answers, is met. */
  completed: boolean;
  /** True once the user has shared their app feedback after reaching 100%. */
  feedbackSubmitted: boolean;
  /** When each goal was started and completed. */
  timeline: AnveshanTimeline;
}

/** Answer fields returned to the client. */
export interface AnveshanAnswerView {
  answer: string;
  sources: AnveshanAnswerSource[];
  remarks: string | null;
  answeredAt: Date;
  score: AnveshanAnswerScoreView | null;
}

/** Score fields returned to the client; the raw scoring service response stays server side. */
export type AnveshanAnswerScoreView = Omit<AnveshanAnswerScore, 'response'>;

export interface AnveshanAnswerableQuestion {
  id: string;
  questionText: string;
  cropType: string;
  state: string;
  district: string;
  language: string;
  status: Question['status'];
  submittedAt: Date;
  isAnswerSubmitted: boolean;
  answer: AnveshanAnswerView | null;
}

@Injectable()
export class AnveshanMilestoneService {
  private readonly logger = new Logger(AnveshanMilestoneService.name);

  constructor(
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
    @Inject(REPOSITORY_TOKENS.AnveshanAnswer)
    private readonly answerRepo: IAnveshanAnswerRepository,
    @Inject(REPOSITORY_TOKENS.AppFeedback)
    private readonly feedbackRepo: IAppFeedbackRepository,
    private readonly questionService: QuestionService,
    private readonly userService: UserService,
    private readonly agriEntityService: AgriEntitiesService,
    private readonly scoringService: AnveshanScoringService,
  ) {}

  // Returns the caller's milestone progress across submissions and answers, with when each goal was started and met.
  async getMilestone(userId: string): Promise<AnveshanMilestone> {
    const { milestone, eligibleQuestions } = await this.buildMilestone(userId);
    const [feedbackSubmitted, timeline] = await Promise.all([
      milestone.completed
        ? this.feedbackRepo.count({ userId, context: 'anveshan_completion' }).then((count) => count > 0)
        : Promise.resolve(false),
      this.buildTimeline(userId, milestone.requirements, eligibleQuestions),
    ]);
    return { ...milestone, feedbackSubmitted, timeline };
  }

  // Lists the questions the caller may answer (their first required-count submissions) with answer status.
  async listAnswerableQuestions(userId: string) {
    const { milestone, eligibleQuestions } = await this.buildMilestone(userId);
    const answersByQuestion = await this.findAnswersByQuestion(userId, eligibleQuestions);
    const scoringEnabled = isAnswerScoringEnabled();
    return {
      items: eligibleQuestions.map((question) =>
        toAnswerableQuestion(question, answersByQuestion.get(question.id) ?? null, scoringEnabled),
      ),
      /** False when AI scoring is turned off; the web app then shows no scores. */
      scoringEnabled,
      requiredAnswers: milestone.requirements.answers,
      answeredCount: milestone.progress.answers,
      unlocked: milestone.submissionsCompleted,
      completed: milestone.completed,
      requirements: milestone.requirements,
      progress: milestone.progress,
    };
  }

  // Returns the stored Anveshan answer for a question, or null when none was submitted. Used by staff review screens.
  async getAnswerForQuestion(questionId: string): Promise<AnveshanAnswer | null> {
    return this.answerRepo.findOne({ questionId });
  }

  // Saves the caller's answer for one of their eligible questions. Each question can be answered once,
  // and no more answers are accepted once the required number has been submitted.
  async submitAnswer(userId: string, questionId: string, dto: SubmitAnveshanAnswerDto) {
    const { milestone, eligibleQuestions } = await this.buildMilestone(userId);
    if (!milestone.submissionsCompleted) {
      throw new ForbiddenException('Complete your submission goals before writing advisories.');
    }

    const question = eligibleQuestions.find((q) => q.id === questionId);
    if (!question) {
      throw new NotFoundException('This query is not in your advisory list.');
    }

    const requiredAnswers = milestone.requirements.answers;
    if (!question.isAnswerSubmitted && countAnveshanAnswers(eligibleQuestions) >= requiredAnswers) {
      throw new ForbiddenException(answerLimitMessage(requiredAnswers));
    }

    // Claim the question first: this conditional flag update lets only one request through.
    const { affected } = await this.questionRepo.updateMany(
      { id: questionId, userId, isAnswerSubmitted: { $ne: true } },
      { isAnswerSubmitted: true },
    );
    if (!affected) {
      throw new ConflictException('You have already submitted an advisory for this query.');
    }

    // Guards against parallel requests for different questions both passing the limit check above.
    const answeredNow = countAnveshanAnswers(await findAnveshanAnswerableQuestions(this.questionRepo, userId));
    if (answeredNow > requiredAnswers) {
      await this.questionRepo.updateMany({ id: questionId, userId }, { isAnswerSubmitted: false });
      throw new ForbiddenException(answerLimitMessage(requiredAnswers));
    }

    let saved: AnveshanAnswer;
    try {
      saved = await this.answerRepo.create({
        questionId,
        userId,
        answer: dto.answer,
        sources: dto.sources.map(({ sourceType, sourceName, source, page }) => ({
          sourceType,
          sourceName,
          source,
          page: page || null,
        })),
        remarks: dto.remarks || null,
        answeredAt: new Date(),
      });
    } catch (error) {
      // Release the claim so the user can retry if the answer could not be stored.
      await this.questionRepo.updateMany({ id: questionId, userId }, { isAnswerSubmitted: false });
      throw error;
    }

    // The answer is already stored, so a scoring failure is recorded on it rather than failing the request.
    // With scoring turned off the answer is only stored, without any call to the scoring service.
    const scoringEnabled = isAnswerScoringEnabled();
    if (scoringEnabled) {
      saved = { ...saved, score: await this.requestScore(saved, question) };
    }

    const answeredCount = milestone.progress.answers + 1;
    return {
      question: toAnswerableQuestion({ ...question, isAnswerSubmitted: true }, saved, scoringEnabled),
      answeredCount: Math.min(answeredCount, requiredAnswers),
      requiredAnswers,
      completed: answeredCount >= requiredAnswers,
    };
  }

  // Returns the caller's score for an answered question, without the raw scoring service response.
  async getAnswerScore(userId: string, questionId: string): Promise<AnveshanAnswerScoreView> {
    if (!isAnswerScoringEnabled()) {
      throw new NotFoundException('Advisory scoring is not available.');
    }
    return toScoreView(await this.refreshAnswerScore(userId, questionId));
  }

  // Loads the caller's answer and brings its score up to date.
  private async refreshAnswerScore(userId: string, questionId: string): Promise<AnveshanAnswerScore> {
    const answer = await this.answerRepo.findOne({ userId, questionId });
    if (!answer) {
      throw new NotFoundException('No advisory found for this query.');
    }
    return this.syncAnswerScore(answer);
  }

  // Answers whose scoring job is still processing, oldest first. Used by the background score check.
  async findAnswersAwaitingScore(limit: number): Promise<AnveshanAnswer[]> {
    return this.answerRepo.findAll(
      { 'score.status': 'processing' },
      { pagination: { page: 1, limit, sort: { 'score.requestedAt': 1 } } },
    );
  }

  // Brings an answer's score up to date. While the job is processing this asks the scoring service for the
  // latest state and stores the full result once it completes. A failed job, or one the scoring service lost
  // or has kept processing for too long, is started again.
  async syncAnswerScore(answer: AnveshanAnswer): Promise<AnveshanAnswerScore> {
    const userId = answer.userId;
    const score = answer.score;
    if (score?.status === 'completed') return score;
    if (!score?.jobId || score.status === 'failed') return this.restartScore(answer, userId);

    try {
      const job = await this.scoringService.getJob(score.jobId);
      if (job.status === 'missing') {
        if (!isJobOlderThan(score, ANVESHAN_SCORE_MISSING_GRACE_MS)) return score;
        this.logger.warn(`[Scoring] job ${score.jobId} is unknown to the scoring service; starting a new one`);
        return this.restartScore(answer, userId);
      }
      if (job.status === 'processing') {
        return isStaleJob(score) ? this.restartStaleJob(answer, userId, score) : score;
      }
      // A failed job keeps whatever partial score it returned; the next score request starts a new job.
      const next: AnveshanAnswerScore = { ...job.score, jobId: score.jobId, requestedAt: score.requestedAt };
      await this.answerRepo.update(answer.id, { score: next });
      return next;
    } catch (error) {
      // A temporary outage keeps the job as processing so the client can keep polling, until it goes stale.
      this.logger.warn(`[Scoring] could not read job ${score.jobId}: ${error}`);
      return isStaleJob(score) ? this.restartStaleJob(answer, userId, score) : score;
    }
  }

  // Starts a new scoring job for an answer whose previous job failed or was lost.
  private async restartScore(answer: AnveshanAnswer, userId: string): Promise<AnveshanAnswerScore> {
    const question = await this.questionRepo.findOne({ id: answer.questionId, userId });
    if (!question) throw new NotFoundException('This query is not in your advisory list.');
    return this.requestScore(answer, question);
  }

  // Replaces a job that has been processing longer than the stale limit.
  private restartStaleJob(answer: AnveshanAnswer, userId: string, score: AnveshanAnswerScore): Promise<AnveshanAnswerScore> {
    this.logger.warn(`[Scoring] job ${score.jobId} still processing after the time limit; starting a new one`);
    return this.restartScore(answer, userId);
  }

  // Starts a scoring job for the answer and stores its state. Never throws, so a scoring outage
  // does not affect the saved answer; the job is marked failed and started again on the next score request.
  private async requestScore(answer: AnveshanAnswer, question: Question): Promise<AnveshanAnswerScore> {
    const requestedAt = new Date();
    let score: AnveshanAnswerScore;
    try {
      const jobId = await this.scoringService.startJob({
        answerId: answer.id,
        question: question.questionText,
        answer: answer.answer,
        crop: question.cropType,
        state: question.state,
        sources: answer.sources,
      });
      score = emptyScore(jobId, 'processing', requestedAt);
    } catch (error) {
      this.logger.error(`[Scoring] could not start job for answer ${answer.id}: ${error}`);
      score = emptyScore(null, 'failed', requestedAt);
    }

    try {
      await this.answerRepo.update(answer.id, { score });
    } catch (error) {
      this.logger.error(`[Scoring] could not store score state for answer ${answer.id}: ${error}`);
    }
    return score;
  }

  // Loads counts and eligible questions once, so callers share a single consistent snapshot.
  private async buildMilestone(userId: string) {
    const user = await this.userService.getProfile(userId);
    if (!user?.isAnveshanUser) {
      throw new ForbiddenException('This milestone is only available to Anveshan users.');
    }

    const [questionsSubmitted, agriCounts, eligibleQuestions] = await Promise.all([
      this.questionService.getTotalSubmittedCount(userId),
      this.agriEntityService.getSubmittedCountsByType(userId),
      findAnveshanAnswerableQuestions(this.questionRepo, userId),
    ]);
    const { requirements, progress, submissionsCompleted, completed } = evaluateAnveshanProgress({
      questions: questionsSubmitted,
      ...agriCounts,
      answers: countAnveshanAnswers(eligibleQuestions),
    });

    return { milestone: { requirements, progress, submissionsCompleted, completed }, eligibleQuestions };
  }

  // Start and completion times for every goal, from the submissions that count towards it.
  private async buildTimeline(
    userId: string,
    requirements: AnveshanCounts,
    eligibleQuestions: Question[],
  ): Promise<AnveshanTimeline> {
    const agriLimit = Math.max(requirements.crop, requirements.weed, requirements.pest, requirements.disease);
    const [agriDates, answersByQuestion] = await Promise.all([
      this.agriEntityService.getEarliestSubmissionDatesByType(userId, agriLimit),
      this.findAnswersByQuestion(userId, eligibleQuestions),
    ]);
    const answerDates = [...answersByQuestion.values()].map((answer) => answer.answeredAt);

    return {
      questions: toStepTimeline(eligibleQuestions.map((q) => q.submittedAt), requirements.questions),
      crop: toStepTimeline(agriDates.crop, requirements.crop),
      weed: toStepTimeline(agriDates.weed, requirements.weed),
      pest: toStepTimeline(agriDates.pest, requirements.pest),
      disease: toStepTimeline(agriDates.disease, requirements.disease),
      answers: toStepTimeline(answerDates, requirements.answers),
    };
  }

  // Loads the stored answers for the answered questions only, keyed by question id.
  private async findAnswersByQuestion(userId: string, questions: Question[]): Promise<Map<string, AnveshanAnswer>> {
    const answeredIds = questions.filter((q) => q.isAnswerSubmitted).map((q) => q.id);
    if (answeredIds.length === 0) return new Map();
    const answers = await this.answerRepo.find({ userId, questionId: { $in: answeredIds } });
    return new Map(answers.map((answer) => [answer.questionId, answer]));
  }
}

// True when a processing job was requested longer ago than the stale limit.
function isStaleJob(score: AnveshanAnswerScore): boolean {
  return isJobOlderThan(score, ANVESHAN_SCORE_JOB_STALE_AFTER_MS);
}

// True when the job was requested more than ageMs ago. A missing or invalid date never counts as old.
function isJobOlderThan(score: AnveshanAnswerScore, ageMs: number, now = Date.now()): boolean {
  const requestedAt = new Date(score.requestedAt).getTime();
  return Number.isFinite(requestedAt) && now - requestedAt > ageMs;
}

// Score placeholder used until the scoring job completes.
function emptyScore(jobId: string | null, status: AnveshanAnswerScore['status'], requestedAt: Date): AnveshanAnswerScore {
  return {
    jobId,
    status,
    systemScore: null,
    maxScore: null,
    percentage: null,
    needsHumanReview: null,
    reviewReasons: [],
    checks: [],
    notApplicable: [],
    notEvaluated: [],
    checkedAt: null,
    requestedAt,
    response: null,
  };
}

// Removes the raw scoring service response before a score is sent to the client.
function toScoreView(score: AnveshanAnswerScore): AnveshanAnswerScoreView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { response, ...view } = toPlainScore(score);
  return view;
}

// A score loaded from the database is a Mongoose subdocument whose fields are getters, so spreading it
// copies Mongoose internals instead of the score. Converting it first keeps the fields and drops the internals.
function toPlainScore(score: AnveshanAnswerScore): AnveshanAnswerScore {
  const subdocument = score as AnveshanAnswerScore & { toObject?: () => AnveshanAnswerScore };
  return typeof subdocument.toObject === 'function' ? subdocument.toObject() : score;
}

// Message returned when the user tries to answer beyond the required number of questions.
function answerLimitMessage(requiredAnswers: number): string {
  return `You have already submitted the required ${requiredAnswers} advisories. No more advisories can be submitted.`;
}

// Maps a question and its answer for the client. The score is left out when scoring is turned off.
function toAnswerableQuestion(
  question: Question,
  answer: AnveshanAnswer | null,
  includeScore: boolean,
): AnveshanAnswerableQuestion {
  return {
    id: question.id,
    questionText: question.questionText,
    cropType: question.cropType,
    state: question.state,
    district: question.district,
    language: question.language,
    status: question.status,
    submittedAt: question.submittedAt,
    isAnswerSubmitted: !!question.isAnswerSubmitted,
    answer: answer
      ? {
          answer: answer.answer,
          sources: answer.sources,
          remarks: answer.remarks,
          answeredAt: answer.answeredAt,
          score: includeScore && answer.score ? toScoreView(answer.score) : null,
        }
      : null,
  };
}
