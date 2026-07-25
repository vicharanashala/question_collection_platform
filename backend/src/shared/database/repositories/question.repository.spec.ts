import { QuestionStatus } from '../../classes/enums';
import { MongoQuestionRepository } from './impl/mongo/MongoQuestion.repository';

// ─── MongoQuestionRepository ─────────────────────────────────────────────────

describe('MongoQuestionRepository.getLeaderboard()', () => {
  let mockModel: Record<string, jest.Mock>;
  let repo: MongoQuestionRepository;

  beforeEach(() => {
    // Minimal Model stub that supports .aggregate()
    mockModel = {
      aggregate: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    } as unknown as Record<string, jest.Mock>;
    repo = new MongoQuestionRepository(mockModel as never);
  });

  it('builds the correct MongoDB aggregation pipeline', async () => {
    mockModel.exec.mockResolvedValue([
      { userId: 'user-a', approvedCount: 10 },
      { userId: 'user-b', approvedCount: 5 },
    ]);

    const results = await repo.getLeaderboard(100);

    expect(mockModel.aggregate).toHaveBeenCalledWith([
      { $match: { status: QuestionStatus.APPROVED } },
      { $group: { _id: '$userId', approvedCount: { $sum: 1 } } },
      { $sort: { approvedCount: -1 } },
      { $limit: 100 },
      { $project: { _id: 0, userId: '$_id', approvedCount: 1 } },
    ]);
    expect(mockModel.exec).toHaveBeenCalled();
    expect(results).toEqual([
      { userId: 'user-a', approvedCount: 10 },
      { userId: 'user-b', approvedCount: 5 },
    ]);
  });

  it('passes the caller-supplied limit to $limit stage', async () => {
    mockModel.exec.mockResolvedValue([]);

    await repo.getLeaderboard(25);

    const pipeline = mockModel.aggregate.mock.calls[0][0];
    const limitStage = pipeline.find((s: Record<string, unknown>) => '$limit' in s);
    expect(limitStage['$limit']).toBe(25);
  });

  it('returns empty array when no approved questions exist', async () => {
    mockModel.exec.mockResolvedValue([]);

    const results = await repo.getLeaderboard(100);

    expect(results).toEqual([]);
  });
});