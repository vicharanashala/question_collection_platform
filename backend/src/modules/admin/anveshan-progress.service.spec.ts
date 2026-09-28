import { Test, TestingModule } from '@nestjs/testing';
import { AnveshanProgressService } from './anveshan-progress.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { AgriEntityType } from '../../shared/classes/enums';

// Staging and development need 5 questions; tests run outside production.
const REQUIRED_QUESTIONS = 5;
const allAgriTypes = (userId: string) =>
  [AgriEntityType.CROP, AgriEntityType.WEED, AgriEntityType.PEST, AgriEntityType.DISEASE].map((type) => ({ userId, type, count: 1 }));

describe('AnveshanProgressService', () => {
  let service: AnveshanProgressService;
  const questionRepo = { countSubmissionsByUsers: jest.fn(), findUserIdsWithAnswers: jest.fn() };
  const agriEntityRepo = { countByUsersAndType: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnveshanProgressService,
        { provide: REPOSITORY_TOKENS.Question, useValue: questionRepo },
        { provide: REPOSITORY_TOKENS.AgriEntity, useValue: agriEntityRepo },
      ],
    }).compile();
    service = module.get(AnveshanProgressService);
  });

  it('weighs submissions as 80% and answers as the last 20%', async () => {
    questionRepo.countSubmissionsByUsers.mockResolvedValue([
      { userId: 'done', questions: REQUIRED_QUESTIONS, answers: 2 },
      { userId: 'submitted', questions: REQUIRED_QUESTIONS, answers: 0 },
    ]);
    agriEntityRepo.countByUsersAndType.mockResolvedValue([...allAgriTypes('done'), ...allAgriTypes('submitted')]);

    const progress = await service.getProgressForUsers(['done', 'submitted', 'new']);

    expect(progress.get('done')).toMatchObject({ percent: 100, completed: true });
    expect(progress.get('submitted')).toMatchObject({ percent: 80, submissionsCompleted: true, completed: false });
    expect(progress.get('new')).toMatchObject({ percent: 0, completed: false });
  });

  it('returns only candidates who meet every goal as completed', async () => {
    questionRepo.findUserIdsWithAnswers.mockResolvedValue(['done', 'missing-pest']);
    questionRepo.countSubmissionsByUsers.mockResolvedValue([
      { userId: 'done', questions: REQUIRED_QUESTIONS, answers: 2 },
      { userId: 'missing-pest', questions: REQUIRED_QUESTIONS, answers: 2 },
    ]);
    agriEntityRepo.countByUsersAndType.mockResolvedValue([
      ...allAgriTypes('done'),
      ...allAgriTypes('missing-pest').filter((row) => row.type !== AgriEntityType.PEST),
    ]);

    await expect(service.findCompletedUserIds()).resolves.toEqual(['done']);
    expect(questionRepo.findUserIdsWithAnswers).toHaveBeenCalledWith(2);
  });
});
