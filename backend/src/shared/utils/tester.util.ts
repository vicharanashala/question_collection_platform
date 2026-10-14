import type { IUserRepository } from '../database/repositories';

export const TESTER_FILTER_VALUES = ['only', 'exclude'] as const;

/** Staff list filter: only tester accounts, or everything except tester accounts. */
export type TesterFilter = (typeof TESTER_FILTER_VALUES)[number];

// Condition on a user document's own is_tester flag, or undefined when no filter is set.
export function isTesterCondition(tester?: TesterFilter): Record<string, unknown> | undefined {
  if (tester === 'only') return { is_tester: true };
  if (tester === 'exclude') return { is_tester: { $ne: true } };
  return undefined;
}

// Condition on a userId field, given the ids of all tester users. Undefined when no filter is set.
export function userIdTesterCondition(tester: TesterFilter | undefined, testerIds: string[]): Record<string, unknown> | undefined {
  if (tester === 'only') return { $in: testerIds };
  if (tester === 'exclude') return { $nin: testerIds };
  return undefined;
}

// Ids of every tester user. Testers are few, so one small query per request is enough.
export async function findTesterUserIds(userRepo: IUserRepository): Promise<string[]> {
  const testers = await userRepo.findAll({ is_tester: true });
  return testers.map((user) => user.id);
}
