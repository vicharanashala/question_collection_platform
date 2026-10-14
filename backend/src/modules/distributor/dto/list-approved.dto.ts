import { IsInt, IsOptional, IsString, Max, Min, IsIn } from 'class-validator';
import { AnveshanOnly } from '../../../shared/utils/anveshan-mode.util';
import { TESTER_FILTER_VALUES, type TesterFilter } from '../../../shared/utils/tester.util';
import { Type } from 'class-transformer';

/** Query DTO for GET /distributor/questions (approved questions queue). */
export class ListApprovedQuestionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  sortBy?: string = 'approvedAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  /** Staff filter: only tester accounts, or everything except tester accounts. */
  @IsOptional()
  @IsIn(TESTER_FILTER_VALUES)
  tester?: TesterFilter;

  /** Staff Anveshan mode: only data from Anveshan users. */
  @AnveshanOnly()
  anveshanOnly?: boolean;
}