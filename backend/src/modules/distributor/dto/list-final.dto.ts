import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { INDIAN_STATES } from '../../../shared/constants/indian-states.constant';

/** Query DTO for GET /distributor/distributions (browse final_questions). */
export class ListDistributionsDto {
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

  /**
   * Filter by the target Indian state the question was distributed to.
   * Renamed from `state` to `distributionState` to disambiguate from the
   * source Question's home state (which is also stored on each row as
   * `state`). The URL query param is therefore `?distributionState=...`.
   */
  @IsOptional()
  @IsString()
  @IsIn(INDIAN_STATES as unknown as string[], { message: 'Invalid Indian state.' })
  distributionState?: string;

  /**
   * Case-insensitive substring search over the snapshot of
   * `Question.questionText` that is embedded on each final_question row.
   * Matches against the embedded `questionText` field (camelCase in Mongo).
   */
  @IsOptional()
  @IsString()
  search?: string;
}