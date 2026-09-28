import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { FeedbacksService } from './feedbacks.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { AnveshanMilestoneService } from '../question/anveshan-milestone.service';

describe('FeedbacksService', () => {
  let service: FeedbacksService;
  const feedbackRepo = { create: jest.fn() };
  const milestoneService = { getMilestone: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbacksService,
        { provide: REPOSITORY_TOKENS.AppFeedback, useValue: feedbackRepo },
        { provide: AnveshanMilestoneService, useValue: milestoneService },
      ],
    }).compile();
    service = module.get(FeedbacksService);
  });

  it('saves feedback for users at 100%', async () => {
    milestoneService.getMilestone.mockResolvedValue({ completed: true });
    feedbackRepo.create.mockImplementation((data) => Promise.resolve({ id: 'f-1', ...data }));

    await service.submitAnveshanFeedback('u-1', { rating: 4, comment: 'Useful', inputMethod: 'voice' });

    expect(feedbackRepo.create).toHaveBeenCalledWith({
      userId: 'u-1',
      context: 'anveshan_completion',
      rating: 4,
      comment: 'Useful',
      inputMethod: 'voice',
    });
  });

  it('rejects feedback before the milestone is complete', async () => {
    milestoneService.getMilestone.mockResolvedValue({ completed: false });

    await expect(service.submitAnveshanFeedback('u-1', { rating: 5 })).rejects.toBeInstanceOf(ForbiddenException);
    expect(feedbackRepo.create).not.toHaveBeenCalled();
  });

  it('reports a conflict when feedback was already submitted', async () => {
    milestoneService.getMilestone.mockResolvedValue({ completed: true });
    feedbackRepo.create.mockRejectedValue({ code: 11000 });

    await expect(service.submitAnveshanFeedback('u-1', { rating: 5 })).rejects.toBeInstanceOf(ConflictException);
  });
});
