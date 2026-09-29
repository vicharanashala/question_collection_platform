import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
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
}
