import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { IAppFeedbackRepository, IUserRepository, REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { AnveshanMilestoneService } from '../question/anveshan-milestone.service';
import { ListFeedbacksDto, SubmitAnveshanFeedbackDto } from './dto';

const ANVESHAN_CONTEXT = 'anveshan_completion' as const;
const DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class FeedbacksService {
  constructor(
    @Inject(REPOSITORY_TOKENS.AppFeedback)
    private readonly feedbackRepo: IAppFeedbackRepository,
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    private readonly anveshanMilestoneService: AnveshanMilestoneService,
  ) {}

  // Lists Anveshan feedback for staff, newest first, with the submitter's name and an overall ratings summary.
  async listAnveshanFeedback(dto: ListFeedbacksDto) {
    const { page = 1, limit = 20, rating, inputMethod } = dto;
    const filter = {
      context: ANVESHAN_CONTEXT,
      ...(rating ? { rating } : {}),
      ...(inputMethod ? { inputMethod } : {}),
    };

    const [{ data, total }, summary] = await Promise.all([
      this.feedbackRepo.findAndCount(filter, { pagination: { page, limit, sort: { createdAt: -1 } } }),
      this.feedbackRepo.getRatingSummary(ANVESHAN_CONTEXT),
    ]);

    const userIds = [...new Set(data.map((feedback) => feedback.userId))];
    const users = userIds.length ? await this.userRepo.find({ id: { $in: userIds } }) : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    return {
      items: data.map((feedback) => {
        const user = usersById.get(feedback.userId);
        return {
          id: feedback.id,
          rating: feedback.rating,
          comment: feedback.comment,
          inputMethod: feedback.inputMethod,
          createdAt: feedback.createdAt,
          user: user ? { id: user.id, name: user.name, mobileNumber: user.mobileNumber, state: user.state, district: user.district } : null,
        };
      }),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      summary,
    };
  }

  // Stores an Anveshan user's app feedback once they reach 100%. Each user can submit it once.
  async submitAnveshanFeedback(userId: string, dto: SubmitAnveshanFeedbackDto) {
    const milestone = await this.anveshanMilestoneService.getMilestone(userId);
    if (!milestone.completed) {
      throw new ForbiddenException('Feedback opens once your Anveshan milestone reaches 100%.');
    }

    try {
      const saved = await this.feedbackRepo.create({
        userId,
        context: ANVESHAN_CONTEXT,
        rating: dto.rating,
        comment: dto.comment || null,
        inputMethod: dto.inputMethod ?? 'text',
      });
      return { id: saved.id, message: 'Thank you for your feedback!' };
    } catch (error) {
      // The unique (userId, context) index rejects a second submission, including two at once.
      if ((error as { code?: number })?.code === DUPLICATE_KEY_ERROR) {
        throw new ConflictException('You have already shared your feedback. Thank you!');
      }
      throw error;
    }
  }
}
