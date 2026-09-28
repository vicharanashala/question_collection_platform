import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnveshanMilestoneService } from './anveshan-milestone.service';
import { QuestionService } from './question.service';
import { UserService } from '../user/user.service';
import { AgriEntitiesService } from '../agri-entities/agri-entities.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { SubmitAnveshanAnswerDto } from './dto';

// Staging and development need 5 questions; tests run outside production.
const REQUIRED_QUESTIONS = 5;
const USER_ID = 'user-1';

const buildQuestions = (answered = 0) =>
  Array.from({ length: REQUIRED_QUESTIONS }, (_, i) => ({
    id: `q-${i}`,
    questionText: `Question ${i}`,
    isAnswerSubmitted: i < answered,
  }));

const answerDto: SubmitAnveshanAnswerDto = {
  answer: 'Spray neem oil at 5 ml per litre.',
  sources: [{ sourceType: 'state', sourceName: 'TNAU', source: 'https://agritech.tnau.ac.in/guide.pdf', page: '4' }],
};

describe('AnveshanMilestoneService', () => {
  let service: AnveshanMilestoneService;
  const questionRepo = { find: jest.fn(), updateMany: jest.fn() };
  const answerRepo = { create: jest.fn(), find: jest.fn() };
  const questionService = { getTotalSubmittedCount: jest.fn() };
  const userService = { getProfile: jest.fn() };
  const agriEntityService = { getSubmittedCountsByType: jest.fn() };

  // Sets up a user whose submission goals are met, with the given number of answers.
  const givenSubmissionsDone = (answered = 0) => {
    questionService.getTotalSubmittedCount.mockResolvedValue(REQUIRED_QUESTIONS);
    agriEntityService.getSubmittedCountsByType.mockResolvedValue({ crop: 1, weed: 1, pest: 1, disease: 1 });
    questionRepo.find.mockResolvedValue(buildQuestions(answered));
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    userService.getProfile.mockResolvedValue({ id: USER_ID, isAnveshanUser: true });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnveshanMilestoneService,
        { provide: REPOSITORY_TOKENS.Question, useValue: questionRepo },
        { provide: REPOSITORY_TOKENS.AnveshanAnswer, useValue: answerRepo },
        { provide: QuestionService, useValue: questionService },
        { provide: UserService, useValue: userService },
        { provide: AgriEntitiesService, useValue: agriEntityService },
      ],
    }).compile();
    service = module.get(AnveshanMilestoneService);
  });

  it('unlocks answering but is not complete until two answers are given', async () => {
    givenSubmissionsDone(1);

    const milestone = await service.getMilestone(USER_ID);

    expect(milestone.submissionsCompleted).toBe(true);
    expect(milestone.completed).toBe(false);
    expect(milestone.progress.answers).toBe(1);
    expect(milestone.requirements.answers).toBe(2);
  });

  it('is complete once two of the eligible questions are answered', async () => {
    givenSubmissionsDone(2);

    const milestone = await service.getMilestone(USER_ID);

    expect(milestone.completed).toBe(true);
  });

  it('rejects answers before the submission goals are met', async () => {
    givenSubmissionsDone();
    agriEntityService.getSubmittedCountsByType.mockResolvedValue({ crop: 1, weed: 0, pest: 1, disease: 1 });

    await expect(service.submitAnswer(USER_ID, 'q-0', answerDto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects questions outside the eligible list', async () => {
    givenSubmissionsDone();

    await expect(service.submitAnswer(USER_ID, 'someone-else', answerDto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('flags the question and stores the answer in its own collection', async () => {
    givenSubmissionsDone();
    questionRepo.updateMany.mockResolvedValue({ affected: 1 });
    answerRepo.create.mockImplementation((data) => Promise.resolve({ id: 'a-1', ...data }));

    const result = await service.submitAnswer(USER_ID, 'q-0', answerDto);

    expect(questionRepo.updateMany).toHaveBeenCalledWith(
      { id: 'q-0', userId: USER_ID, isAnswerSubmitted: { $ne: true } },
      { isAnswerSubmitted: true },
    );
    expect(answerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ questionId: 'q-0', userId: USER_ID, answer: answerDto.answer, remarks: null }),
    );
    expect(result.question.isAnswerSubmitted).toBe(true);
    expect(result.answeredCount).toBe(1);
    expect(result.completed).toBe(false);
  });

  it('clears the flag again when the answer cannot be stored', async () => {
    givenSubmissionsDone();
    questionRepo.updateMany.mockResolvedValue({ affected: 1 });
    answerRepo.create.mockRejectedValue(new Error('write failed'));

    await expect(service.submitAnswer(USER_ID, 'q-0', answerDto)).rejects.toThrow('write failed');
    expect(questionRepo.updateMany).toHaveBeenLastCalledWith({ id: 'q-0', userId: USER_ID }, { isAnswerSubmitted: false });
  });

  it('attaches stored answers to answered questions when listing', async () => {
    givenSubmissionsDone(1);
    answerRepo.find.mockResolvedValue([{ questionId: 'q-0', answer: 'Neem oil', sources: [], remarks: null, answeredAt: new Date() }]);

    const result = await service.listAnswerableQuestions(USER_ID);

    expect(answerRepo.find).toHaveBeenCalledWith({ userId: USER_ID, questionId: { $in: ['q-0'] } });
    expect(result.items[0].answer?.answer).toBe('Neem oil');
    expect(result.items[1].answer).toBeNull();
  });

  it('reports a conflict when the question was already answered', async () => {
    givenSubmissionsDone();
    questionRepo.updateMany.mockResolvedValue({ affected: 0 });

    await expect(service.submitAnswer(USER_ID, 'q-0', answerDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks non-Anveshan users', async () => {
    userService.getProfile.mockResolvedValue({ id: USER_ID, isAnveshanUser: false });

    await expect(service.getMilestone(USER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
