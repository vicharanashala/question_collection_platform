import { IsString, IsIn, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListReviewQueueDto {
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
  @IsIn(['human_review', 'ai_review'])
  queueType?: 'human_review' | 'ai_review';
}

export class ReviewActionDto {
  @IsString()
  @IsIn(['approve', 'reject', 'request_info'])
  action: 'approve' | 'reject' | 'request_info';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RequestMoreInfoDto {
  @IsString()
  message: string;
}