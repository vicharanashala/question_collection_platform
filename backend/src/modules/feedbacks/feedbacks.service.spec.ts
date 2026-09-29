import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { FeedbacksService } from './feedbacks.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { AnveshanMilestoneService } from '../question/anveshan-milestone.service';

describe('FeedbacksService', () => {
  let service: FeedbacksService;
  const feedbackRepo = { create: jest.fn(), findAndCount: jest.fn(), getRatingSummary: jest.fn() };
  const userRepo = { find: jest.fn() };
  const milestoneService = { getMilestone: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedbacksService,
        { provide: REPOSITORY_TOKENS.AppFeedback, useValue: feedbackRepo },
        { provide: REPOSITORY_TOKENS.User, useValue: userRepo },
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

  it('lists feedback with submitter details and the ratings summary', async () => {
    const summary = { total: 1, averageRating: 4, distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 } };
    feedbackRepo.findAndCount.mockResolvedValue({
      data: [{ id: 'f-1', userId: 'u-1', rating: 4, comment: 'Useful', inputMethod: 'voice', createdAt: new Date() }],
      total: 1,
    });
    feedbackRepo.getRatingSummary.mockResolvedValue(summary);
    userRepo.find.mockResolvedValue([{ id: 'u-1', name: 'Abiram', mobileNumber: '999', state: 'Kerala', district: 'Thrissur' }]);

    const result = await service.listAnveshanFeedback({ page: 1, limit: 20, rating: 4 });

    expect(feedbackRepo.findAndCount).toHaveBeenCalledWith(
      { context: 'anveshan_completion', rating: 4 },
      { pagination: { page: 1, limit: 20, sort: { createdAt: -1 } } },
    );
    expect(result.items[0].user?.name).toBe('Abiram');
    expect(result.summary).toEqual(summary);
  });

  it('reports a conflict when feedback was already submitted', async () => {
    milestoneService.getMilestone.mockResolvedValue({ completed: true });
    feedbackRepo.create.mockRejectedValue({ code: 11000 });

    await expect(service.submitAnveshanFeedback('u-1', { rating: 5 })).rejects.toBeInstanceOf(ConflictException);
  });
});
