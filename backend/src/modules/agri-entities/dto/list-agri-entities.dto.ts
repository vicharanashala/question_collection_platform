import { IsEnum, IsInt, IsOptional, Max, Min, IsIn } from 'class-validator';
import { AnveshanOnly } from '../../../shared/utils/anveshan-mode.util';
import { TESTER_FILTER_VALUES, type TesterFilter } from '../../../shared/utils/tester.util';
import { Transform } from 'class-transformer';
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

  /** Staff Anveshan mode: only data from Anveshan users. */
  @AnveshanOnly()
  anveshanOnly?: boolean;
}
