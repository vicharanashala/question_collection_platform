import { IsOptional, IsString, IsIn, IsDateString } from 'class-validator';

export class ExportQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  cropType?: string;

  @IsOptional()
  @IsString()
  domainCategory?: string;

  @IsOptional()
  @IsIn(['csv', 'excel'])
  format?: 'csv' | 'excel' = 'csv';

  @IsOptional()
  @IsIn(['questions', 'users', 'rewards', 'withdrawals'])
  dataType?: 'questions' | 'users' | 'rewards' | 'withdrawals' = 'questions';
}