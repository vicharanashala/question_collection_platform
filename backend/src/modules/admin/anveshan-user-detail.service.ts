import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IAgriEntityRepository,
  IAnveshanAnswerRepository,
  IQuestionRepository,
  IUserRepository,
  REPOSITORY_TOKENS,
} from '../../shared/database/repositories';
import { AdminService } from './admin.service';
import { AnveshanProgressService } from './anveshan-progress.service';

const MAX_QUESTIONS = 500;

// Everything staff need to review one Anveshan user: profile, progress, questions with answers, and entities.
@Injectable()
export class AnveshanUserDetailService {
  constructor(
    @Inject(REPOSITORY_TOKENS.User) private readonly userRepo: IUserRepository,
    @Inject(REPOSITORY_TOKENS.Question) private readonly questionRepo: IQuestionRepository,
    @Inject(REPOSITORY_TOKENS.AgriEntity) private readonly agriEntityRepo: IAgriEntityRepository,
    @Inject(REPOSITORY_TOKENS.AnveshanAnswer) private readonly answerRepo: IAnveshanAnswerRepository,
    private readonly adminService: AdminService,
    private readonly progressService: AnveshanProgressService,
  ) {}

  // Loads the detail view data, or throws when the user does not exist or is not an Anveshan user.
  async getDetail(userId: string) {
    const account = await this.userRepo.findById(userId);
    if (!account?.isAnveshanUser) throw new NotFoundException('Anveshan user not found');

    const [{ user }, progressById, questions, answers, entities] = await Promise.all([
      this.adminService.getUserDetail(userId),
      this.progressService.getProgressForUsers([userId]),
      this.questionRepo.findAll({ userId }, { pagination: { page: 1, limit: MAX_QUESTIONS, sort: { submittedAt: -1 } } }),
      this.answerRepo.findAll({ userId }),
      this.agriEntityRepo.findOrderedBySubmission({ filter: { userId }, order: 'desc' }),
    ]);
    const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));

    return {
      user: { ...user, isAnveshanUser: true },
      progress: progressById.get(userId) ?? null,
      questions: questions.map((question) => {
        const answer = answerByQuestion.get(question._id.toString());
        return {
          id: question._id.toString(),
          questionText: question.questionText,
          cropType: question.cropType,
          season: question.season,
          state: question.state,
          district: question.district,
          language: question.language,
          status: question.status,
          submittedAt: question.submittedAt,
          reviewedAt: question.reviewedAt,
          rejectionReason: question.rejectionReason,
          heldReason: question.heldReason,
          approvalReason: question.approvalReason,
          isAnswerSubmitted: question.isAnswerSubmitted,
          answer: answer
            ? {
                answer: answer.answer,
                sources: answer.sources,
                remarks: answer.remarks,
                answeredAt: answer.answeredAt,
                scorePercentage: answer.score?.percentage ?? null,
              }
            : null,
        };
      }),
      entities: entities.data,
    };
  }
}
