import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { TESTER_FILTER_VALUES, type TesterFilter } from '../../../shared/utils/tester.util';
import { Transform } from 'class-transformer';

const toInt = ({ value }: { value: unknown }) => (value === undefined || value === '' ? undefined : parseInt(String(value), 10));

export class ListFeedbacksDto {
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Only feedback with this star rating. */
  @IsOptional()
  @Transform(toInt)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsIn(['text', 'voice'])
  inputMethod?: 'text' | 'voice';

  /** Staff filter: only tester accounts, or everything except tester accounts. */
  @IsOptional()
  @IsIn(TESTER_FILTER_VALUES)
  tester?: TesterFilter;
}
