import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';

// Staging and development need 5 questions; tests run outside production.
const REQUIRED_QUESTIONS = 5;


describe('UserService.getAnveshanProgress', () => {
  let service: UserService;
  const userRepo = { findByMobile: jest.fn() };
  const questionRepo = { countByUserId: jest.fn(), find: jest.fn() };
  const agriEntityRepo = { count: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    userRepo.findByMobile.mockResolvedValue({ id: 'user-1', isAnveshanUser: true });
    questionRepo.countByUserId.mockResolvedValue(REQUIRED_QUESTIONS);
    agriEntityRepo.count.mockResolvedValue(1);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: REPOSITORY_TOKENS.User, useValue: userRepo },
        { provide: REPOSITORY_TOKENS.AuditLog, useValue: {} },
        { provide: REPOSITORY_TOKENS.Notification, useValue: {} },
        { provide: REPOSITORY_TOKENS.Question, useValue: questionRepo },
        { provide: REPOSITORY_TOKENS.Transaction, useValue: {} },
        { provide: REPOSITORY_TOKENS.AgriEntity, useValue: agriEntityRepo },
      ],
    }).compile();
    service = module.get(UserService);
  });

  it('is not complete when submissions are met but fewer than two answers exist', async () => {
    questionRepo.find.mockResolvedValue([{ id: 'q-1', isAnswerSubmitted: true }, { id: 'q-2', isAnswerSubmitted: false }]);

    const result = await service.getAnveshanProgress('9999999999');

    expect(result.isCompleted).toBe(false);
    expect(result.requirements.questions.met).toBe(true);
    expect(result.requirements.answerCreated).toEqual({ required: 2, submitted: 1, met: false });
  });

  it('is complete once two answers exist', async () => {
    questionRepo.find.mockResolvedValue([{ id: 'q-1', isAnswerSubmitted: true }, { id: 'q-2', isAnswerSubmitted: true }]);

    const result = await service.getAnveshanProgress('9999999999');

    expect(result.isCompleted).toBe(true);
    expect(result.requirements.answerCreated).toEqual({ required: 2, submitted: 2, met: true });
  });

  it('reports zero answers for non-Anveshan users', async () => {
    userRepo.findByMobile.mockResolvedValue({ id: 'user-1', isAnveshanUser: false });

    const result = await service.getAnveshanProgress('9999999999');

    expect(result.isCompleted).toBe(false);
    expect(result.requirements.answerCreated).toEqual({ required: 2, submitted: 0, met: false });
  });
});
