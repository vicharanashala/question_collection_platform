import {
  IsString,
  IsOptional,
  IsIn,
  MaxLength,
} from 'class-validator';
import { IsInArray } from '../../common/validators/is-in-array.validator';

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  questionText?: string;

  @IsString()
  @IsOptional()
  @IsIn(['crop_protection', 'spray', 'irrigation', 'fertilizer', 'soil_health', 'seed', 'harvest', 'post_harvest', 'weather', 'market', 'livestock', 'other'])
  domainCategory?: string;

  @IsString()
  @IsOptional()
  @IsIn(['kharif', 'rabi', 'zaid', 'year_round'])
  season?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  cropType?: string;

  @IsOptional()
  @IsIn(['none', 'image', 'video', 'audio'])
  mediaType?: 'none' | 'image' | 'video' | 'audio';

  @IsOptional()
  mediaUrls?: string[];
}