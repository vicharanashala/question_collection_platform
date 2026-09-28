import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { IAppFeedbackRepository, REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { AnveshanMilestoneService } from '../question/anveshan-milestone.service';
import { SubmitAnveshanFeedbackDto } from './dto';

const ANVESHAN_CONTEXT = 'anveshan_completion' as const;
const DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class FeedbacksService {
  constructor(
    @Inject(REPOSITORY_TOKENS.AppFeedback)
    private readonly feedbackRepo: IAppFeedbackRepository,
    private readonly anveshanMilestoneService: AnveshanMilestoneService,
  ) {}

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
