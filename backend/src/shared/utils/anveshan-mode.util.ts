import { applyDecorators } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import type { IUserRepository } from '../database/repositories';
import { findTesterUserIds, type TesterFilter } from './tester.util';

export const ANVESHAN_SCOPE_VALUES = ['only', 'exclude'] as const;

/** Staff Anveshan mode: only Anveshan users, or everyone except Anveshan users. Unset means all. */
export type AnveshanScope = (typeof ANVESHAN_SCOPE_VALUES)[number];

/** Query parameter for the staff Anveshan mode. */
export const AnveshanScope = () => applyDecorators(IsOptional(), IsIn(ANVESHAN_SCOPE_VALUES));

/** Staff list scope shared by every list that filters on the submitting user. */
export interface UserScope {
  tester?: TesterFilter;
  anveshanScope?: AnveshanScope;
}

// Condition on a userId field for the tester filter and Anveshan mode together, or undefined when neither is set.
export async function resolveUserIdScope(
  userRepo: IUserRepository,
  scope: UserScope,
): Promise<Record<string, unknown> | undefined> {
  if (!scope.tester && !scope.anveshanScope) return undefined;

  let include: Set<string> | null = null;
  const exclude = new Set<string>();

  if (scope.anveshanScope) {
    const anveshanIds = (await userRepo.findAll({ isAnveshanUser: true })).map((user) => user._id.toString());
    if (scope.anveshanScope === 'only') include = new Set(anveshanIds);
    else anveshanIds.forEach((id) => exclude.add(id));
  }

  if (scope.tester) {
    const testerIds = await findTesterUserIds(userRepo);
    if (scope.tester === 'only') {
      include = include ? new Set(testerIds.filter((id) => include!.has(id))) : new Set(testerIds);
    } else {
      testerIds.forEach((id) => exclude.add(id));
    }
  }

  if (include) return { $in: [...include].filter((id) => !exclude.has(id)) };
  return { $nin: [...exclude] };
}
