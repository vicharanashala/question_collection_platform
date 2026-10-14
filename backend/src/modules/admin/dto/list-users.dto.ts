import { IsOptional, IsString, IsIn, IsInt, Min, Max, IsDateString } from 'class-validator';
import { AnveshanOnly } from '../../../shared/utils/anveshan-mode.util';
import { TESTER_FILTER_VALUES, type TesterFilter } from '../../../shared/utils/tester.util';
import { Transform } from 'class-transformer';
import { VerificationStatus, UserCategory, UserRole } from '../../../shared/classes/enums';

export class ListUsersDto {
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

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsIn(Object.values(UserRole))
  role?: UserRole;

  @IsOptional()
  @IsIn(['farmer', 'fpo', 'student', 'volunteer', 'ngo', 'anveshan_user'])
  category?: UserCategory;

  @IsOptional()
  @IsIn(['pending', 'manual_review', 'verified', 'suspended', 'banned'])
  status?: VerificationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  excludeId?: string;

  @IsOptional()
  @IsIn(['createdAt', 'name', 'state', 'verificationStatus'])
  sortBy?: 'createdAt' | 'name' | 'state' | 'verificationStatus';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  /** Anveshan filter: every Anveshan user, only those at 100%, or only those still in progress. */
  @IsOptional()
  @IsIn(['all', 'completed', 'incomplete'])
  anveshan?: 'all' | 'completed' | 'incomplete';

  /** Staff filter: only tester accounts, or everything except tester accounts. */
  @IsOptional()
  @IsIn(TESTER_FILTER_VALUES)
  tester?: TesterFilter;

  /** Staff Anveshan mode: only data from Anveshan users. */
  @AnveshanOnly()
  anveshanOnly?: boolean;

  /** Only users who joined on or after this date (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  /** Only users who joined on or before this date (YYYY-MM-DD, inclusive). */
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

/** Date range for the user count summary shown above the users list. */
export class ListUserStatsDto {
  @AnveshanOnly()
  anveshanOnly?: boolean;

  @IsOptional()
  @IsIn(TESTER_FILTER_VALUES)
  tester?: TesterFilter;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
