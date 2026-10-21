import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AnveshanUserDetailService } from './anveshan-user-detail.service';
import { AdminService } from './admin.service';
import { AnveshanProgressService } from './anveshan-progress.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';

describe('AnveshanUserDetailService', () => {
  let service: AnveshanUserDetailService;
  const userRepo = { findById: jest.fn() };
  const questionRepo = { findAll: jest.fn() };
  const agriEntityRepo = { findOrderedBySubmission: jest.fn() };
  const answerRepo = { findAll: jest.fn() };
  const adminService = { getUserDetail: jest.fn() };
  const progressService = { getProgressForUsers: jest.fn() };

  beforeEach(async () => {
    userRepo.findById.mockReset().mockResolvedValue({ id: 'u1', isAnveshanUser: true });
    questionRepo.findAll.mockReset().mockResolvedValue([
      { id: 'q1', questionText: 'Q1', isAnswerSubmitted: true },
      { id: 'q2', questionText: 'Q2', isAnswerSubmitted: false },
    ]);
    answerRepo.findAll.mockReset().mockResolvedValue([
      { questionId: 'q1', answer: 'A1', sources: [], remarks: null, answeredAt: new Date(), score: { percentage: 80 } },
    ]);
    agriEntityRepo.findOrderedBySubmission.mockReset().mockResolvedValue({ data: [{ id: 'e1' }], total: 1 });
    adminService.getUserDetail.mockReset().mockResolvedValue({ user: { id: 'u1', name: 'Asha' } });
    progressService.getProgressForUsers.mockReset().mockResolvedValue(new Map([['u1', { percent: 50 }]]));
    const module = await Test.createTestingModule({
      providers: [
        AnveshanUserDetailService,
        { provide: REPOSITORY_TOKENS.User, useValue: userRepo },
        { provide: REPOSITORY_TOKENS.Question, useValue: questionRepo },
        { provide: REPOSITORY_TOKENS.AgriEntity, useValue: agriEntityRepo },
        { provide: REPOSITORY_TOKENS.AnveshanAnswer, useValue: answerRepo },
        { provide: AdminService, useValue: adminService },
        { provide: AnveshanProgressService, useValue: progressService },
      ],
    }).compile();
    service = module.get(AnveshanUserDetailService);
  });

  it('returns profile, progress, questions with answers and entities newest first', async () => {
    const detail = await service.getDetail('u1');

    expect(detail.user).toMatchObject({ id: 'u1', isAnveshanUser: true });
    expect(detail.progress).toEqual({ percent: 50 });
    expect(detail.questions[0].answer).toMatchObject({ answer: 'A1', scorePercentage: 80 });
    expect(detail.questions[1].answer).toBeNull();
    expect(detail.entities).toEqual([{ id: 'e1' }]);
    expect(agriEntityRepo.findOrderedBySubmission).toHaveBeenCalledWith({ filter: { userId: 'u1' }, order: 'desc' });
  });

  it('rejects users who are not Anveshan users', async () => {
    userRepo.findById.mockResolvedValue({ id: 'u2', isAnveshanUser: false });

    await expect(service.getDetail('u2')).rejects.toBeInstanceOf(NotFoundException);
  });
});
