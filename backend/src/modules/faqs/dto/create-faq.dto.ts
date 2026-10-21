import { IsString, IsNotEmpty, IsBoolean, IsOptional, MaxLength, IsIn } from 'class-validator';
import { FAQ_AUDIENCES, FaqAudience } from '@/shared/database/mongodb/schemas/faq.schema';

export class CreateFaqDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;

  @IsString()
  @IsNotEmpty()
  answer: string;

  @IsIn(['account', 'payment', 'question', 'general'])
  @IsOptional()
  category?: 'account' | 'payment' | 'question' | 'general' = 'general';

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean = true;

  @IsIn(FAQ_AUDIENCES)
  @IsOptional()
  audience?: FaqAudience = 'all';
}