import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IAnveshanAnswerRepository,
  IAppFeedbackRepository,
  IQuestionRepository,
  REPOSITORY_TOKENS,
} from '../../shared/database/repositories';
import type { AnveshanAnswer, AnveshanAnswerSource, Question } from '../../shared/database/entities';
import { UserService } from '../user/user.service';
import { AgriEntitiesService } from '../agri-entities/agri-entities.service';
import { QuestionService } from './question.service';
import { SubmitAnveshanAnswerDto } from './dto';
import {
  type AnveshanCounts,
  type AnveshanTimeline,
  countAnveshanAnswers,
  evaluateAnveshanProgress,
  findAnveshanAnswerableQuestions,
  toStepTimeline,
} from '../../shared/utils/anveshan.util';


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
}

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
    return {
      items: eligibleQuestions.map((question) => toAnswerableQuestion(question, answersByQuestion.get(question.id) ?? null)),
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

    const answeredCount = milestone.progress.answers + 1;
    return {
      question: toAnswerableQuestion({ ...question, isAnswerSubmitted: true }, saved),
      answeredCount: Math.min(answeredCount, requiredAnswers),
      requiredAnswers,
      completed: answeredCount >= requiredAnswers,
    };
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

// Message returned when the user tries to answer beyond the required number of questions.
function answerLimitMessage(requiredAnswers: number): string {
  return `You have already submitted the required ${requiredAnswers} advisories. No more advisories can be submitted.`;
}

function toAnswerableQuestion(question: Question, answer: AnveshanAnswer | null): AnveshanAnswerableQuestion {
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
      ? { answer: answer.answer, sources: answer.sources, remarks: answer.remarks, answeredAt: answer.answeredAt }
      : null,
  };
}
