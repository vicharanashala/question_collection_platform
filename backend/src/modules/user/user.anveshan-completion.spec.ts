import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';
import { AnveshanSubmissionsOpenGuard } from './guards/anveshan-submissions-open.guard';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';

// Staging and development need 5 questions; tests run outside production.
const REQUIRED_QUESTIONS = 5;

const answeredQuestions = (answered: number) =>
  Array.from({ length: REQUIRED_QUESTIONS }, (_, i) => ({ id: `q-${i}`, isAnswerSubmitted: i < answered }));

describe('UserService.isAnveshanMilestoneCompleted', () => {
  let service: UserService;
  const userRepo = { findOne: jest.fn() };
  const questionRepo = { countByUserId: jest.fn(), find: jest.fn() };
  const agriEntityRepo = { count: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    userRepo.findOne.mockResolvedValue({ id: 'user-1', isAnveshanUser: true });
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

  it('is completed once every goal including two answers is met', async () => {
    questionRepo.find.mockResolvedValue(answeredQuestions(2));

    await expect(service.isAnveshanMilestoneCompleted('user-1')).resolves.toBe(true);
  });

  it('is not completed while answers are still missing', async () => {
    questionRepo.find.mockResolvedValue(answeredQuestions(1));

    await expect(service.isAnveshanMilestoneCompleted('user-1')).resolves.toBe(false);
  });

  it('is never completed for non-Anveshan users and skips the counts', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'user-1', isAnveshanUser: false });

    await expect(service.isAnveshanMilestoneCompleted('user-1')).resolves.toBe(false);
    expect(questionRepo.countByUserId).not.toHaveBeenCalled();
  });
});

describe('AnveshanSubmissionsOpenGuard', () => {
  const userService = { isAnveshanMilestoneCompleted: jest.fn() };
  const guard = new AnveshanSubmissionsOpenGuard(userService as unknown as UserService);
  const contextFor = (user?: { id: string }) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

  beforeEach(() => jest.resetAllMocks());

  it('rejects submissions from users who completed the milestone', async () => {
    userService.isAnveshanMilestoneCompleted.mockResolvedValue(true);

    await expect(guard.canActivate(contextFor({ id: 'user-1' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows submissions from users who have not completed it', async () => {
    userService.isAnveshanMilestoneCompleted.mockResolvedValue(false);

    await expect(guard.canActivate(contextFor({ id: 'user-1' }))).resolves.toBe(true);
  });
});
