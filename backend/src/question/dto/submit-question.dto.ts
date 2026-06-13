import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  IsObject,
  IsArray,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Season } from '../../common/enums';

export class SubmitQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  language: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['crop_protection', 'spray', 'irrigation', 'fertilizer', 'soil_health', 'seed', 'harvest', 'post_harvest', 'weather', 'market', 'livestock', 'other'])
  domainCategory: string;

  @IsString()
  @IsIn([Season.KHARIF, Season.RABI, Season.ZAID, Season.YEAR_ROUND])
  season: Season;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  cropType: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  questionText: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  block?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  agroClimaticZone?: string;

  @IsOptional()
  @IsIn(['none', 'image', 'video', 'audio'])
  mediaType?: 'none' | 'image' | 'video' | 'audio';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, unknown>;
}

export class SubmitQuestionResponseDto {
  id: string;
  status: string;
  editWindowClosesAt: string;
  message: string;
}