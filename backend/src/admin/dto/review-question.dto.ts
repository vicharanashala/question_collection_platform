import { IsString, IsIn, IsOptional, IsInt, Min, Max, IsDateString, IsArray } from 'class-validator';
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

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.includes(',')) return value.split(',').map((s: string) => s.trim());
    if (Array.isArray(value)) return value.map((s: string) => s.trim());
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  @IsIn(['pending', 'ai_review', 'human_review', 'held', 'approved', 'rejected'], { each: true })
  status?: string[];

  @IsOptional()
  @IsString()
  sortBy?: 'submittedAt' | 'aiConfidenceScore' | 'state' | 'reviewedAt' | 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  @Transform(({ value }) => (value === 'true' ? 'ASC' : value === 'false' ? 'DESC' : value))
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class ReviewActionDto {
  @IsString()
  @IsIn(['approve', 'reject', 'hold', 'request_info'])
  action: 'approve' | 'reject' | 'hold' | 'request_info';

  /** Required when action is 'reject'; reason for rejection */
  @IsOptional()
  @IsString()
  reason?: string;

  /** Required when action is 'hold'; reason for holding */
  @IsOptional()
  @IsString()
  heldReason?: string;
}

export class HoldQuestionDto {
  @IsString()
  reason: string;
}