import { IsOptional, IsString, IsIn, IsInt, Min, Max, IsDateString } from 'class-validator';
import { TESTER_FILTER_VALUES, type TesterFilter } from '../../../shared/utils/tester.util';
import { Transform } from 'class-transformer';

export class ListQuestionsDto {
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
  status?: string;

  @IsOptional()
  @IsString()
  domains?: string;

  @IsOptional()
  @IsString()
  cropType?: string;

  @IsOptional()
  @IsString()
  season?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  /** Anveshan answer filter: questions with a submitted answer, or Anveshan questions still awaiting one. */
  @IsOptional()
  @IsIn(['answered', 'unanswered'])
  answerStatus?: 'answered' | 'unanswered';

  /** Submitter type filter, based on the question's Anveshan flag. */
  @IsOptional()
  @IsIn(['anveshan', 'regular'])
  userType?: 'anveshan' | 'regular';

  /** Staff filter: only tester accounts, or everything except tester accounts. */
  @IsOptional()
  @IsIn(TESTER_FILTER_VALUES)
  tester?: TesterFilter;
}