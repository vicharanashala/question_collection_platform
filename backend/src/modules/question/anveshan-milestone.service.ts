import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IQuestionRepository, REPOSITORY_TOKENS } from '../../shared/database/repositories';
import type { AnveshanAnswer, Question } from '../../shared/database/entities';
import {
  ANVESHAN_REQUIRED_ANSWER_COUNT,
  getAnveshanRequiredQuestionCount,
} from '../../shared/constants/anveshan.constant';
import { UserService } from '../user/user.service';
import { AgriEntitiesService } from '../agri-entities/agri-entities.service';
import { QuestionService } from './question.service';
import { SubmitAnveshanAnswerDto } from './dto';

type MilestoneCounts = { questions: number; crop: number; weed: number; pest: number; disease: number; answers: number };

export interface AnveshanMilestone {
  requirements: MilestoneCounts;
  progress: MilestoneCounts;
  /** True once the question and crop/weed/pest/disease goals are met, which unlocks answering. */
  submissionsCompleted: boolean;
  /** True once every goal, including answers, is met. */
  completed: boolean;
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
  answer: AnveshanAnswer | null;
}

@Injectable()
export class AnveshanMilestoneService {
  constructor(
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
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
    return {
      items: eligibleQuestions.map(toAnswerableQuestion),
      requiredAnswers: milestone.requirements.answers,
      answeredCount: milestone.progress.answers,
      unlocked: milestone.submissionsCompleted,
      completed: milestone.completed,
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

    const anveshanAnswer: AnveshanAnswer = {
      answer: dto.answer,
      sources: dto.sources.map(({ sourceType, sourceName, source, page }) => ({
        sourceType,
        sourceName,
        source,
        page: page || null,
      })),
      remarks: dto.remarks || null,
      answeredAt: new Date(),
    };

    // Conditional write so a double submit cannot overwrite an existing answer.
    const { affected } = await this.questionRepo.updateMany(
      { id: questionId, userId, anveshanAnswer: null },
      { anveshanAnswer },
    );
    if (!affected) {
      throw new ConflictException('You have already answered this question.');
    }

    const answeredCount = milestone.progress.answers + 1;
    const requiredAnswers = milestone.requirements.answers;
    return {
      question: toAnswerableQuestion({ ...question, anveshanAnswer }),
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
      this.findEligibleQuestions(userId, requiredQuestions),
    ]);
    const answersGiven = eligibleQuestions.filter((q) => q.anveshanAnswer).length;

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

  // The user's earliest submissions, up to the required question count, are the ones they answer.
  private findEligibleQuestions(userId: string, limit: number): Promise<Question[]> {
    return this.questionRepo.find({ userId }, { pagination: { page: 1, limit, sort: { submittedAt: 1 } } });
  }
}

// Caps every count at its requirement so extra submissions do not over-count.
function capCounts(actual: MilestoneCounts, requirements: MilestoneCounts): MilestoneCounts {
  const keys = Object.keys(requirements) as (keyof MilestoneCounts)[];
  return Object.fromEntries(keys.map((key) => [key, Math.min(actual[key], requirements[key])])) as MilestoneCounts;
}

function toAnswerableQuestion(question: Question): AnveshanAnswerableQuestion {
  return {
    id: question.id,
    questionText: question.questionText,
    cropType: question.cropType,
    state: question.state,
    district: question.district,
    language: question.language,
    status: question.status,
    submittedAt: question.submittedAt,
    answer: question.anveshanAnswer ?? null,
  };
}
