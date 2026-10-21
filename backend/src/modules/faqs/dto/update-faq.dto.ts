import { IsString, IsBoolean, IsOptional, MaxLength, IsIn, IsInt, Min } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateFaqDto } from './create-faq.dto';
import { FAQ_AUDIENCES, FaqAudience } from '@/shared/database/mongodb/schemas/faq.schema';

export class UpdateFaqDto extends PartialType(CreateFaqDto) {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  question?: string;

  @IsString()
  @IsOptional()
  answer?: string;

  @IsIn(['account', 'payment', 'question', 'general'])
  @IsOptional()
  category?: 'account' | 'payment' | 'question' | 'general';

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @IsIn(FAQ_AUDIENCES)
  @IsOptional()
  audience?: FaqAudience;

  @IsInt()
  @Min(0)
  @IsOptional()
  displayOrder?: number;
}