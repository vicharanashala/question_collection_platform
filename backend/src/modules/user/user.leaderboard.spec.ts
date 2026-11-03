import { UserService } from './user.service';
import type { IUserRepository } from '../../shared/database/repositories/IUser.repository';

type LeaderboardRepo = Pick<IUserRepository, 'getLeaderboard' | 'getLeaderboardRank'>;

// Builds a UserService whose only real dependency is the leaderboard part of the user repository.
function buildService(repo: LeaderboardRepo): UserService {
  const unused = {} as never;
  return new UserService(repo as IUserRepository, unused, unused, unused, unused, unused, unused);
}

// Creates a mock repo that returns the given page and rank.
function mockRepo(
  entries: Array<{ id: string; name: string; totalQuestions: number }>,
  rank: { rank: number; totalQuestions: number } | null,
  total = entries.length,
) {
  return {
    getLeaderboard: jest.fn().mockResolvedValue({
      entries,
      total,
      totalApprovedQuestions: entries.reduce((sum, e) => sum + e.totalQuestions, 0),
    }),
    getLeaderboardRank: jest.fn().mockResolvedValue(rank),
  };
}

describe('UserService.getLeaderboard', () => {
  const rows = [
    { id: 'u1', name: 'Asha', totalQuestions: 12 },
    { id: 'u2', name: 'Bala', totalQuestions: 9 },
    { id: 'u3', name: 'Chitra', totalQuestions: 9 },
    { id: 'u4', name: 'Dev', totalQuestions: 0 },
  ];

  it('keeps the repository order and assigns ranks by approved question count', async () => {
    const service = buildService(mockRepo(rows, { rank: 2, totalQuestions: 9 }));

    const result = await service.getLeaderboard('u2');

    expect(result.entries.map((e) => [e.rank, e.userId, e.totalQuestions])).toEqual([
      [1, 'u1', 12],
      [2, 'u2', 9],
      [3, 'u3', 9],
      [4, 'u4', 0],
    ]);
    expect(result.totalApprovedQuestions).toBe(30);
  });

  it('returns no earnings field on entries', async () => {
    const service = buildService(mockRepo(rows, null));

    const result = await service.getLeaderboard('u1');

    for (const entry of result.entries) {
      expect(entry).not.toHaveProperty('totalEarned');
    }
  });

  it('awards medals to the top three only when they have approved questions', async () => {
    const zeroTop = [
      { id: 'u1', name: 'Asha', totalQuestions: 3 },
      { id: 'u2', name: 'Bala', totalQuestions: 0 },
    ];
    const service = buildService(mockRepo(zeroTop, null));

    const result = await service.getLeaderboard('u9');

    expect(result.entries.map((e) => e.medal)).toEqual(['gold', null]);
  });

  it('uses global ranks on later pages', async () => {
    const page = [{ id: 'u21', name: 'Kiran', totalQuestions: 1 }];
    const repo = mockRepo(page, null, 25);
    const service = buildService(repo);

    const result = await service.getLeaderboard('u1', { limit: 10, offset: 20 });

    expect(repo.getLeaderboard).toHaveBeenCalledWith({ limit: 10, offset: 20 });
    expect(result.entries[0].rank).toBe(21);
    expect(result.entries[0].medal).toBeNull();
  });

  it('marks the current user and returns their own rank and count', async () => {
    const service = buildService(mockRepo(rows, { rank: 3, totalQuestions: 9 }));

    const result = await service.getLeaderboard('u3');

    expect(result.entries.find((e) => e.isCurrentUser)?.userId).toBe('u3');
    expect(result.userRank).toBe(3);
    expect(result.userTotalQuestions).toBe(9);
  });

  it('returns a null rank and zero count for users who are not eligible', async () => {
    const service = buildService(mockRepo(rows, null));

    const result = await service.getLeaderboard('not-ranked');

    expect(result.userRank).toBeNull();
    expect(result.userTotalQuestions).toBe(0);
    expect(result.entries.some((e) => e.isCurrentUser)).toBe(false);
  });

  it('clamps limit and offset to safe bounds', async () => {
    const repo = mockRepo([], null);
    const service = buildService(repo);

    await service.getLeaderboard('u1', { limit: 1000, offset: -5 });

    expect(repo.getLeaderboard).toHaveBeenCalledWith({ limit: 100, offset: 0 });
  });
});
