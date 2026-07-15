import { IsString, IsOptional, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListFaqsQueryDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;

  @IsIn(['account', 'payment', 'question', 'general'])
  @IsOptional()
  category?: 'account' | 'payment' | 'question' | 'general';
}