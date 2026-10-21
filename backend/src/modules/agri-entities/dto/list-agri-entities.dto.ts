import { IsEnum, IsInt, IsOptional, IsString, Max, Min, IsIn } from 'class-validator';
import { AnveshanScope } from '../../../shared/utils/anveshan-mode.util';
import { TESTER_FILTER_VALUES, type TesterFilter } from '../../../shared/utils/tester.util';
import { Transform } from 'class-transformer';
import { UserIdsQuery } from '../../../shared/utils/user-ids-query.util';
import { AgriEntityStatus, AgriEntityType } from '../../../shared/classes/enums';

export class ListAgriEntitiesDto {
  @IsOptional()
  @IsEnum(AgriEntityType)
  type?: AgriEntityType;

  @IsOptional()
  @IsEnum(AgriEntityStatus)
  status?: AgriEntityStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  /** Staff filter: only tester accounts, or everything except tester accounts. */
  @IsOptional()
  @IsIn(TESTER_FILTER_VALUES)
  tester?: TesterFilter;

  /** Staff Anveshan mode: only Anveshan users or everyone except them. */
  @AnveshanScope()
  anveshanScope?: AnveshanScope;

  /** Super Admin filter: only entities submitted by these users (comma separated or repeated). */
  @UserIdsQuery()
  userIds?: string[];

  /** Staff list order by submission date. Defaults to newest first. */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

/** Query for the Super Admin user filter options. */
export class UserFilterQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(TESTER_FILTER_VALUES)
  tester?: TesterFilter;

  @AnveshanScope()
  anveshanScope?: AnveshanScope;
}
