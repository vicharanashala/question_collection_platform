import { IsString, IsOptional, IsInt, Min, Max, IsIn, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetUserWalletDto {
  @IsString()
  userId!: string;
}

export class ListUserTransactionsDto {
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
  limit?: number = 50;

  @IsOptional()
  @IsIn(['all', 'credit', 'debit'])
  type?: 'all' | 'credit' | 'debit';

  @IsOptional()
  @IsIn(['all', 'completed', 'pending', 'failed', 'reversed', 'rejected'])
  status?: 'all' | 'completed' | 'pending' | 'failed' | 'reversed' | 'rejected';

  @IsOptional()
  @IsIn(['all', 'reward', 'withdrawal', 'refund'])
  source?: 'all' | 'reward' | 'withdrawal' | 'refund';

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsIn(['createdAt', 'amount'])
  sortBy?: 'createdAt' | 'amount';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

export class ListUserWithdrawalsDto {
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
  @IsIn(['pending', 'processing', 'completed', 'rejected'])
  status?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class AdjustWalletDto {
  @IsString()
  userId!: string;

  @IsInt()
  @Transform(({ value }) => parseInt(value, 10))
  amount!: number; // positive = credit, negative = debit (handled in service)

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ListAllWalletsDto {
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
  limit?: number = 50;

  @IsOptional()
  @IsString()
  userId?: string; // filter by specific user

  @IsOptional()
  @IsString()
  search?: string; // name or mobile

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsIn(['balance', 'createdAt'])
  sortBy?: 'balance' | 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

export class UserWalletSummaryDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}