import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import type { IUserRepository } from '../database/repositories';
import { findTesterUserIds, userIdTesterCondition, type TesterFilter } from './tester.util';

/** Query flag sent by staff while Anveshan mode is on: only data from Anveshan users. */
export const AnveshanOnly = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }) => value === true || value === 'true'),
    IsBoolean(),
  );

/** Staff list scope shared by every list that filters on the submitting user. */
export interface UserScope {
  tester?: TesterFilter;
  anveshanOnly?: boolean;
}

// Condition on a userId field for the tester filter and Anveshan mode together, or undefined when neither is set.
export async function resolveUserIdScope(
  userRepo: IUserRepository,
  scope: UserScope,
): Promise<Record<string, unknown> | undefined> {
  if (!scope.anveshanOnly) {
    return scope.tester ? userIdTesterCondition(scope.tester, await findTesterUserIds(userRepo)) : undefined;
  }
  const anveshanUsers = await userRepo.findAll({ isAnveshanUser: true });
  let ids = anveshanUsers.map((user) => user.id);
  if (scope.tester) {
    const testerIds = new Set(await findTesterUserIds(userRepo));
    ids = ids.filter((id) => (scope.tester === 'only' ? testerIds.has(id) : !testerIds.has(id)));
  }
  return { $in: ids };
}
