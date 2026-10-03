import { AnveshanScorePollerService } from './anveshan-score-poller.service';
import { AnveshanMilestoneService } from './anveshan-milestone.service';

describe('AnveshanScorePollerService', () => {
  const milestoneService = { findAnswersAwaitingScore: jest.fn(), syncAnswerScore: jest.fn() };
  let poller: AnveshanScorePollerService;

  beforeEach(() => {
    jest.resetAllMocks();
    poller = new AnveshanScorePollerService(milestoneService as unknown as AnveshanMilestoneService);
  });

  afterEach(() => poller.onModuleDestroy());

  it('updates every processing answer', async () => {
    milestoneService.findAnswersAwaitingScore.mockResolvedValue([{ id: 'a-1' }, { id: 'a-2' }]);
    milestoneService.syncAnswerScore.mockResolvedValue({ status: 'completed' });

    await poller.checkProcessingScores();

    expect(milestoneService.findAnswersAwaitingScore).toHaveBeenCalledWith(50);
    expect(milestoneService.syncAnswerScore).toHaveBeenCalledTimes(2);
  });

  it('keeps going when one answer fails', async () => {
    milestoneService.findAnswersAwaitingScore.mockResolvedValue([{ id: 'a-1' }, { id: 'a-2' }]);
    milestoneService.syncAnswerScore.mockRejectedValueOnce(new Error('question deleted')).mockResolvedValue({ status: 'processing' });

    await expect(poller.checkProcessingScores()).resolves.toBeUndefined();
    expect(milestoneService.syncAnswerScore).toHaveBeenCalledTimes(2);
  });

  it('skips a run while the previous one is still going', async () => {
    let finishFirstRun: (value: unknown[]) => void = () => undefined;
    milestoneService.findAnswersAwaitingScore.mockReturnValueOnce(new Promise((resolve) => (finishFirstRun = resolve)));

    const firstRun = poller.checkProcessingScores();
    await poller.checkProcessingScores();
    finishFirstRun([]);
    await firstRun;

    expect(milestoneService.findAnswersAwaitingScore).toHaveBeenCalledTimes(1);
  });

  it('runs once a minute', () => {
    jest.useFakeTimers();
    milestoneService.findAnswersAwaitingScore.mockResolvedValue([]);

    poller.onModuleInit();
    jest.advanceTimersByTime(60_000);

    expect(milestoneService.findAnswersAwaitingScore).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
