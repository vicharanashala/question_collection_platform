import { resolveUserIdScope } from '../../../../src/shared/utils/anveshan-mode.util';
import type { IUserRepository } from '../../../../src/shared/database/repositories';

// Users: a and b are Anveshan users, b and c are testers.
const ANVESHAN_IDS = ['a', 'b'];
const TESTER_IDS = ['b', 'c'];

function userRepoDouble() {
  const findAll = jest.fn((filter: Record<string, unknown>) => {
    const ids = filter.isAnveshanUser ? ANVESHAN_IDS : TESTER_IDS;
    return Promise.resolve(ids.map((id) => ({ _id: { toString: () => id } })));
  });
  return { repo: { findAll } as unknown as IUserRepository, findAll };
}

describe('resolveUserIdScope', () => {
  it('returns undefined and skips the database when no scope is set', async () => {
    const { repo, findAll } = userRepoDouble();

    await expect(resolveUserIdScope(repo, {})).resolves.toBeUndefined();
    expect(findAll).not.toHaveBeenCalled();
  });

  it('includes only Anveshan users', async () => {
    const { repo } = userRepoDouble();

    await expect(resolveUserIdScope(repo, { anveshanScope: 'only' })).resolves.toEqual({ $in: ['a', 'b'] });
  });

  it('excludes Anveshan users', async () => {
    const { repo } = userRepoDouble();

    await expect(resolveUserIdScope(repo, { anveshanScope: 'exclude' })).resolves.toEqual({ $nin: ['a', 'b'] });
  });

  it('includes only testers', async () => {
    const { repo } = userRepoDouble();

    await expect(resolveUserIdScope(repo, { tester: 'only' })).resolves.toEqual({ $in: ['b', 'c'] });
  });

  it('intersects Anveshan-only with tester-only', async () => {
    const { repo } = userRepoDouble();

    await expect(resolveUserIdScope(repo, { anveshanScope: 'only', tester: 'only' })).resolves.toEqual({ $in: ['b'] });
  });

  it('removes testers from the Anveshan-only set', async () => {
    const { repo } = userRepoDouble();

    await expect(resolveUserIdScope(repo, { anveshanScope: 'only', tester: 'exclude' })).resolves.toEqual({ $in: ['a'] });
  });

  it('removes Anveshan users from the tester-only set', async () => {
    const { repo } = userRepoDouble();

    await expect(resolveUserIdScope(repo, { anveshanScope: 'exclude', tester: 'only' })).resolves.toEqual({ $in: ['c'] });
  });

  it('excludes both groups when both are excluded', async () => {
    const { repo } = userRepoDouble();

    const scope = await resolveUserIdScope(repo, { anveshanScope: 'exclude', tester: 'exclude' });

    expect((scope as { $nin: string[] }).$nin.sort()).toEqual(['a', 'b', 'c']);
  });
});
