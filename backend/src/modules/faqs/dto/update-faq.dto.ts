import { IsString, IsBoolean, IsOptional, MaxLength, IsIn } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateFaqDto } from './create-faq.dto';

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
}