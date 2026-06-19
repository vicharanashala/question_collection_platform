import { IsString, IsIn, IsOptional, IsInt, Min, Max, IsDateString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListWithdrawalsDto {
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
  @IsIn(['pending', 'processing', 'completed', 'rejected', 'failed'])
  status?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['pending', 'processing', 'completed', 'rejected', 'failed', 'all'])
  filterStatus?: string;

  @IsOptional()
  @IsIn(['amount', 'createdAt', 'processedAt'])
  sortBy?: 'amount' | 'createdAt' | 'processedAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class ProcessWithdrawalDto {
  @IsString()
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Rejection reason must not exceed 500 characters.' })
  rejectionReason?: string;
}

export class MarkWithdrawalFailedDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}