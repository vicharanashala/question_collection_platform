import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export const MAX_FEEDBACK_COMMENT_LENGTH = 2000;

export class SubmitAnveshanFeedbackDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(MAX_FEEDBACK_COMMENT_LENGTH)
  comment?: string;

  /** Whether the comment was dictated with the microphone or typed. */
  @IsOptional()
  @IsIn(['text', 'voice'])
  inputMethod?: 'text' | 'voice';
}
