import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsObject,
  IsArray,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Season } from '../../common/enums';

export class SubmitQuestionDto {
  /**
   * Language code (ISO 639-1). If omitted, defaults to the user's languagePreference.
   * The mobile app no longer sends this field — it is derived server-side.
   */
  @IsString()
  @IsOptional()
  @MaxLength(50)
  language?: string;

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
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsOptional()
  block?: string;

  @ValidateIf((o) => o.agroClimaticZone !== undefined && o.agroClimaticZone !== null && o.agroClimaticZone !== '')
  @IsString({ message: 'agroClimaticZone must be a string' })
  @MaxLength(255, { message: 'agroClimaticZone must be shorter than or equal to 255 characters' })
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