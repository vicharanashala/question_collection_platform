import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnveshanMilestoneService } from './anveshan-milestone.service';
import { QuestionService } from './question.service';
import { UserService } from '../user/user.service';
import { AgriEntitiesService } from '../agri-entities/agri-entities.service';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { SubmitAnveshanAnswerDto } from './dto';
import { AnveshanScoringService } from '../ai/anveshan-scoring.service';

// Staging and development need 5 questions; tests run outside production.
const REQUIRED_QUESTIONS = 5;
const USER_ID = 'user-1';

const buildQuestions = (answered = 0) =>
  Array.from({ length: REQUIRED_QUESTIONS }, (_, i) => ({
    id: `q-${i}`,
    questionText: `Question ${i}`,
    isAnswerSubmitted: i < answered,
    submittedAt: new Date(Date.UTC(2026, 8, 1 + i)),
  }));

const answerDto: SubmitAnveshanAnswerDto = {
  answer: 'Spray neem oil at 5 ml per litre.',
  sources: [{ sourceType: 'state', sourceName: 'TNAU', source: 'https://agritech.tnau.ac.in/guide.pdf', page: '4' }],
};

describe('AnveshanMilestoneService', () => {
  let service: AnveshanMilestoneService;
  const questionRepo = { find: jest.fn(), findOne: jest.fn(), updateMany: jest.fn() };
  const answerRepo = { create: jest.fn(), find: jest.fn(), findOne: jest.fn(), update: jest.fn() };
  const scoringService = { startJob: jest.fn(), getJob: jest.fn() };
  const feedbackRepo = { count: jest.fn() };
  const questionService = { getTotalSubmittedCount: jest.fn() };
  const userService = { getProfile: jest.fn() };
  const agriEntityService = { getSubmittedCountsByType: jest.fn(), getEarliestSubmissionDatesByType: jest.fn() };

  // Sets up a user whose submission goals are met, with the given number of answers.
  const givenSubmissionsDone = (answered = 0) => {
    questionService.getTotalSubmittedCount.mockResolvedValue(REQUIRED_QUESTIONS);
    agriEntityService.getSubmittedCountsByType.mockResolvedValue({ crop: 1, weed: 1, pest: 1, disease: 1 });
    questionRepo.find.mockResolvedValue(buildQuestions(answered));
    agriEntityService.getEarliestSubmissionDatesByType.mockResolvedValue({ crop: [], weed: [], pest: [], disease: [] });
    answerRepo.find.mockResolvedValue([]);
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    userService.getProfile.mockResolvedValue({ id: USER_ID, isAnveshanUser: true });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnveshanMilestoneService,
        { provide: REPOSITORY_TOKENS.Question, useValue: questionRepo },
        { provide: REPOSITORY_TOKENS.AnveshanAnswer, useValue: answerRepo },
        { provide: REPOSITORY_TOKENS.AppFeedback, useValue: feedbackRepo },
        { provide: QuestionService, useValue: questionService },
        { provide: UserService, useValue: userService },
        { provide: AgriEntitiesService, useValue: agriEntityService },
        { provide: AnveshanScoringService, useValue: scoringService },
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
    feedbackRepo.count.mockResolvedValue(0);

    const milestone = await service.getMilestone(USER_ID);

    expect(milestone.completed).toBe(true);
    expect(milestone.feedbackSubmitted).toBe(false);
  });

  it('reports feedback as submitted once the user has shared it', async () => {
    givenSubmissionsDone(2);
    feedbackRepo.count.mockResolvedValue(1);

    const milestone = await service.getMilestone(USER_ID);

    expect(feedbackRepo.count).toHaveBeenCalledWith({ userId: USER_ID, context: 'anveshan_completion' });
    expect(milestone.feedbackSubmitted).toBe(true);
  });

  it('reports when each goal was started and completed', async () => {
    givenSubmissionsDone(2);
    const cropAt = new Date(Date.UTC(2026, 8, 2, 10));
    agriEntityService.getEarliestSubmissionDatesByType.mockResolvedValue({ crop: [cropAt], weed: [], pest: [], disease: [] });
    answerRepo.find.mockResolvedValue([
      { questionId: 'q-1', answeredAt: new Date(Date.UTC(2026, 8, 20)) },
      { questionId: 'q-0', answeredAt: new Date(Date.UTC(2026, 8, 18)) },
    ]);
    feedbackRepo.count.mockResolvedValue(0);

    const { timeline } = await service.getMilestone(USER_ID);

    expect(timeline.questions).toEqual({
      startedAt: new Date(Date.UTC(2026, 8, 1)),
      completedAt: new Date(Date.UTC(2026, 8, 1 + REQUIRED_QUESTIONS - 1)),
    });
    expect(timeline.crop).toEqual({ startedAt: cropAt, completedAt: cropAt });
    expect(timeline.weed).toEqual({ startedAt: null, completedAt: null });
    expect(timeline.answers).toEqual({
      startedAt: new Date(Date.UTC(2026, 8, 18)),
      completedAt: new Date(Date.UTC(2026, 8, 20)),
    });
  });

  it('leaves the completion time empty until a goal is met', async () => {
    givenSubmissionsDone(1);
    answerRepo.find.mockResolvedValue([{ questionId: 'q-0', answeredAt: new Date(Date.UTC(2026, 8, 18)) }]);

    const { timeline } = await service.getMilestone(USER_ID);

    expect(timeline.answers).toEqual({ startedAt: new Date(Date.UTC(2026, 8, 18)), completedAt: null });
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

  it('starts a scoring job for the new answer and stores it as processing', async () => {
    givenSubmissionsDone();
    questionRepo.updateMany.mockResolvedValue({ affected: 1 });
    answerRepo.create.mockImplementation((data) => Promise.resolve({ id: 'a-1', ...data }));
    scoringService.startJob.mockResolvedValue('job-1');

    const result = await service.submitAnswer(USER_ID, 'q-0', answerDto);

    expect(scoringService.startJob).toHaveBeenCalledWith(
      expect.objectContaining({ answerId: 'a-1', question: 'Question 0', answer: answerDto.answer }),
    );
    expect(answerRepo.update).toHaveBeenCalledWith('a-1', { score: expect.objectContaining({ jobId: 'job-1', status: 'processing' }) });
    expect(result.question.answer?.score?.status).toBe('processing');
  });

  it('keeps the answer and marks scoring failed when the scoring service is down', async () => {
    givenSubmissionsDone();
    questionRepo.updateMany.mockResolvedValue({ affected: 1 });
    answerRepo.create.mockImplementation((data) => Promise.resolve({ id: 'a-1', ...data }));
    scoringService.startJob.mockRejectedValue(new Error('connection refused'));

    const result = await service.submitAnswer(USER_ID, 'q-0', answerDto);

    expect(result.question.answer?.score).toEqual(expect.objectContaining({ jobId: null, status: 'failed' }));
    expect(questionRepo.updateMany).toHaveBeenCalledTimes(1);
  });

  it('stores the score once the scoring job completes', async () => {
    const requestedAt = new Date();
    answerRepo.findOne.mockResolvedValue({ id: 'a-1', questionId: 'q-0', score: { jobId: 'job-1', status: 'processing', requestedAt } });
    scoringService.getJob.mockResolvedValue({ status: 'completed', score: { status: 'completed', systemScore: 11, maxScore: 11, percentage: 100 } });

    const score = await service.getAnswerScore(USER_ID, 'q-0');

    expect(answerRepo.findOne).toHaveBeenCalledWith({ userId: USER_ID, questionId: 'q-0' });
    expect(score).toEqual(expect.objectContaining({ jobId: 'job-1', status: 'completed', systemScore: 11, requestedAt }));
    expect(answerRepo.update).toHaveBeenCalledWith('a-1', { score });
  });

  it('stores the full scoring response but does not return it to the client', async () => {
    const response = { jobId: 'job-1', status: 'completed', systemScore: 10, maxScore: 11, extraField: 'kept' };
    answerRepo.findOne.mockResolvedValue({ id: 'a-1', score: { jobId: 'job-1', status: 'processing', requestedAt: new Date() } });
    scoringService.getJob.mockResolvedValue({ status: 'completed', score: { status: 'completed', systemScore: 10, response } });

    const score = await service.getAnswerScore(USER_ID, 'q-0');

    expect(answerRepo.update).toHaveBeenCalledWith('a-1', { score: expect.objectContaining({ response }) });
    expect(score).not.toHaveProperty('response');
    expect(score.systemScore).toBe(10);
  });

  it('stores the partial score of a failed job so the user still sees it', async () => {
    const requestedAt = new Date();
    answerRepo.findOne.mockResolvedValue({ id: 'a-1', score: { jobId: 'job-1', status: 'processing', requestedAt } });
    scoringService.getJob.mockResolvedValue({ status: 'failed', score: { status: 'failed', systemScore: 10, maxScore: 11 } });

    const score = await service.getAnswerScore(USER_ID, 'q-0');

    expect(score).toEqual(expect.objectContaining({ jobId: 'job-1', status: 'failed', systemScore: 10, requestedAt }));
    expect(answerRepo.update).toHaveBeenCalledWith('a-1', { score: expect.objectContaining({ status: 'failed', systemScore: 10 }) });
  });

  it('returns a completed score without calling the scoring service again', async () => {
    answerRepo.findOne.mockResolvedValue({ id: 'a-1', score: { jobId: 'job-1', status: 'completed', systemScore: 9 } });

    const score = await service.getAnswerScore(USER_ID, 'q-0');

    expect(score.systemScore).toBe(9);
    expect(scoringService.getJob).not.toHaveBeenCalled();
  });

  it('restarts scoring when the earlier job could not be started', async () => {
    answerRepo.findOne.mockResolvedValue({ id: 'a-1', answer: 'Neem oil', sources: [], score: { jobId: null, status: 'failed' } });
    questionRepo.findOne.mockResolvedValue({ id: 'q-0', questionText: 'Question 0', cropType: 'Rice', state: 'Kerala' });
    scoringService.startJob.mockResolvedValue('job-2');

    const score = await service.getAnswerScore(USER_ID, 'q-0');

    expect(score).toEqual(expect.objectContaining({ jobId: 'job-2', status: 'processing' }));
  });

  describe('lost or stuck scoring jobs', () => {
    const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);
    // Stores a processing job that was requested the given number of minutes ago.
    const givenProcessingJob = (minutes: number) => {
      answerRepo.findOne.mockResolvedValue({
        id: 'a-1',
        questionId: 'q-0',
        answer: 'Neem oil',
        sources: [],
        score: { jobId: 'job-1', status: 'processing', requestedAt: minutesAgo(minutes) },
      });
      questionRepo.findOne.mockResolvedValue({ id: 'q-0', questionText: 'Question 0', cropType: 'Rice', state: 'Kerala' });
      scoringService.startJob.mockResolvedValue('job-2');
    };

    it('starts a new job when the scoring service no longer knows the job id', async () => {
      givenProcessingJob(2);
      scoringService.getJob.mockResolvedValue({ status: 'missing' });

      const score = await service.getAnswerScore(USER_ID, 'q-0');

      expect(questionRepo.findOne).toHaveBeenCalledWith({ id: 'q-0', userId: USER_ID });
      expect(score).toEqual(expect.objectContaining({ jobId: 'job-2', status: 'processing' }));
    });

    it('starts a new job when the old one has been processing for over 15 minutes', async () => {
      givenProcessingJob(16);
      scoringService.getJob.mockResolvedValue({ status: 'processing' });

      const score = await service.getAnswerScore(USER_ID, 'q-0');

      expect(scoringService.startJob).toHaveBeenCalledTimes(1);
      expect(score.jobId).toBe('job-2');
    });

    it('keeps waiting on a job that is still within the time limit', async () => {
      givenProcessingJob(5);
      scoringService.getJob.mockResolvedValue({ status: 'processing' });

      const score = await service.getAnswerScore(USER_ID, 'q-0');

      expect(scoringService.startJob).not.toHaveBeenCalled();
      expect(score.jobId).toBe('job-1');
    });

    it('starts a new job when the scoring service stays unreachable past the time limit', async () => {
      givenProcessingJob(20);
      scoringService.getJob.mockRejectedValue(new Error('connection refused'));

      const score = await service.getAnswerScore(USER_ID, 'q-0');

      expect(score.jobId).toBe('job-2');
    });

    it('keeps the job during a short outage', async () => {
      givenProcessingJob(3);
      scoringService.getJob.mockRejectedValue(new Error('connection refused'));

      const score = await service.getAnswerScore(USER_ID, 'q-0');

      expect(scoringService.startJob).not.toHaveBeenCalled();
      expect(score.jobId).toBe('job-1');
    });
  });

  it('rejects score requests for questions the caller has not answered', async () => {
    answerRepo.findOne.mockResolvedValue(null);

    await expect(service.getAnswerScore(USER_ID, 'q-0')).rejects.toBeInstanceOf(NotFoundException);
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

  it('rejects a new answer once the required answers are submitted', async () => {
    givenSubmissionsDone(2);

    await expect(service.submitAnswer(USER_ID, 'q-2', answerDto)).rejects.toThrow(
      'You have already submitted the required 2 advisories. No more advisories can be submitted.',
    );
    expect(questionRepo.updateMany).not.toHaveBeenCalled();
  });

  it('releases the claim when a parallel request already reached the answer limit', async () => {
    givenSubmissionsDone(1);
    questionRepo.find
      .mockResolvedValueOnce(buildQuestions(1))
      .mockResolvedValueOnce(buildQuestions(3));
    questionRepo.updateMany.mockResolvedValue({ affected: 1 });

    await expect(service.submitAnswer(USER_ID, 'q-2', answerDto)).rejects.toBeInstanceOf(ForbiddenException);
    expect(questionRepo.updateMany).toHaveBeenLastCalledWith({ id: 'q-2', userId: USER_ID }, { isAnswerSubmitted: false });
    expect(answerRepo.create).not.toHaveBeenCalled();
  });

  it('reports a conflict when the question was already answered', async () => {
    givenSubmissionsDone();
    questionRepo.updateMany.mockResolvedValue({ affected: 0 });

    await expect(service.submitAnswer(USER_ID, 'q-0', answerDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('looks up the answer for a question by its id for staff', async () => {
    answerRepo.findOne.mockResolvedValue({ questionId: 'q-0', answer: 'Neem oil' });

    const answer = await service.getAnswerForQuestion('q-0');

    expect(answerRepo.findOne).toHaveBeenCalledWith({ questionId: 'q-0' });
    expect(answer?.answer).toBe('Neem oil');
  });

  it('blocks non-Anveshan users', async () => {
    userService.getProfile.mockResolvedValue({ id: USER_ID, isAnveshanUser: false });

    await expect(service.getMilestone(USER_ID)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
