import { IsEnum, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { AnveshanOnly } from '../../../shared/utils/anveshan-mode.util';
import { TESTER_FILTER_VALUES, type TesterFilter } from '../../../shared/utils/tester.util';
import { Transform } from 'class-transformer';
import { ReportCategory, ReportPriority, ReportStatus } from '../../../shared/classes/enums';

export class ListReportsDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportCategory)
  category?: ReportCategory;

  @IsOptional()
  @IsEnum(ReportPriority)
  priority?: ReportPriority;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Staff filter: only tester accounts, or everything except tester accounts. */
  @IsOptional()
  @IsIn(TESTER_FILTER_VALUES)
  tester?: TesterFilter;

  /** Staff Anveshan mode: only data from Anveshan users. */
  @AnveshanOnly()
  anveshanOnly?: boolean;
}