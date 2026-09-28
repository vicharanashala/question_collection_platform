import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IAnveshanAnswerRepository, IQuestionRepository, REPOSITORY_TOKENS } from '../../shared/database/repositories';
import type { AnveshanAnswer, AnveshanAnswerSource, Question } from '../../shared/database/entities';
import {
  ANVESHAN_REQUIRED_ANSWER_COUNT,
  getAnveshanRequiredQuestionCount,
} from '../../shared/constants/anveshan.constant';
import { UserService } from '../user/user.service';
import { AgriEntitiesService } from '../agri-entities/agri-entities.service';
import { QuestionService } from './question.service';
import { SubmitAnveshanAnswerDto } from './dto';
import { countAnveshanAnswers, findAnveshanAnswerableQuestions } from '../../shared/utils/anveshan.util';

type MilestoneCounts = { questions: number; crop: number; weed: number; pest: number; disease: number; answers: number };

export interface AnveshanMilestone {
  requirements: MilestoneCounts;
  progress: MilestoneCounts;
  /** True once the question and crop/weed/pest/disease goals are met, which unlocks answering. */
  submissionsCompleted: boolean;
  /** True once every goal, including answers, is met. */
  completed: boolean;
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
    private readonly questionService: QuestionService,
    private readonly userService: UserService,
    private readonly agriEntityService: AgriEntitiesService,
  ) {}

  // Returns the caller's milestone progress across submissions and answers.
  async getMilestone(userId: string): Promise<AnveshanMilestone> {
    const { milestone } = await this.buildMilestone(userId);
    return milestone;
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

  // Saves the caller's answer for one of their eligible questions. Each question can be answered once.
  async submitAnswer(userId: string, questionId: string, dto: SubmitAnveshanAnswerDto) {
    const { milestone, eligibleQuestions } = await this.buildMilestone(userId);
    if (!milestone.submissionsCompleted) {
      throw new ForbiddenException('Complete your submission goals before answering questions.');
    }

    const question = eligibleQuestions.find((q) => q.id === questionId);
    if (!question) {
      throw new NotFoundException('This question is not in your answer list.');
    }

    // Claim the question first: this conditional flag update lets only one request through.
    const { affected } = await this.questionRepo.updateMany(
      { id: questionId, userId, isAnswerSubmitted: { $ne: true } },
      { isAnswerSubmitted: true },
    );
    if (!affected) {
      throw new ConflictException('You have already answered this question.');
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
    const requiredAnswers = milestone.requirements.answers;
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

    const requiredQuestions = getAnveshanRequiredQuestionCount();
    const [questionsSubmitted, agriCounts, eligibleQuestions] = await Promise.all([
      this.questionService.getTotalSubmittedCount(userId),
      this.agriEntityService.getSubmittedCountsByType(userId),
      findAnveshanAnswerableQuestions(this.questionRepo, userId),
    ]);
    const answersGiven = countAnveshanAnswers(eligibleQuestions);

    const requirements: MilestoneCounts = {
      questions: requiredQuestions,
      crop: 1,
      weed: 1,
      pest: 1,
      disease: 1,
      answers: ANVESHAN_REQUIRED_ANSWER_COUNT,
    };
    const actual: MilestoneCounts = { questions: questionsSubmitted, ...agriCounts, answers: answersGiven };
    const progress = capCounts(actual, requirements);

    const submissionsCompleted = (['questions', 'crop', 'weed', 'pest', 'disease'] as const).every(
      (key) => actual[key] >= requirements[key],
    );
    const completed = submissionsCompleted && actual.answers >= requirements.answers;

    return { milestone: { requirements, progress, submissionsCompleted, completed }, eligibleQuestions };
  }

  // Loads the stored answers for the answered questions only, keyed by question id.
  private async findAnswersByQuestion(userId: string, questions: Question[]): Promise<Map<string, AnveshanAnswer>> {
    const answeredIds = questions.filter((q) => q.isAnswerSubmitted).map((q) => q.id);
    if (answeredIds.length === 0) return new Map();
    const answers = await this.answerRepo.find({ userId, questionId: { $in: answeredIds } });
    return new Map(answers.map((answer) => [answer.questionId, answer]));
  }
}

// Caps every count at its requirement so extra submissions do not over-count.
function capCounts(actual: MilestoneCounts, requirements: MilestoneCounts): MilestoneCounts {
  const keys = Object.keys(requirements) as (keyof MilestoneCounts)[];
  return Object.fromEntries(keys.map((key) => [key, Math.min(actual[key], requirements[key])])) as MilestoneCounts;
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
