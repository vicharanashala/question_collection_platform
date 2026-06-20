import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsIn,
  IsObject,
  MaxLength,
  ValidateIf,
  ArrayMinSize,
} from 'class-validator';
import { Season } from '../../common/enums';
import { MaxQuestionChars } from '../../common/validators/max-question-chars.validator';
import { DOMAINS } from '../constants/domains';

export class SubmitQuestionDto {
  /**
   * Language code (ISO 639-1). If omitted, defaults to the user's languagePreference.
   * The mobile app no longer sends this field — it is derived server-side.
   */
  @IsString()
  @IsOptional()
  @MaxLength(50)
  language?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  domains: string[];

  @IsString()
  season: Season;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  cropType: string;

  @IsString()
  @IsNotEmpty()
  @MaxQuestionChars()
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

/**
 * DTO for the /questions/preview endpoint.
 * Only requires questionText + optional mediaType.
 * All location and crop fields are derived server-side from the user's profile.
 */
export class PreviewQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxQuestionChars()
  questionText: string;

  @IsOptional()
  @IsString()
  mediaType?: 'none' | 'image' | 'video' | 'audio';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaUrls?: string[];
}

/**
 * DTO for the /questions/validate endpoint.
 * Mirrors PreviewQuestionDto but is intentionally lean — the mobile app
 * sends only the question text; all other fields are pre-filled or
 * deferred to the preview/submit step.
 *
 * This endpoint is called by the mobile app's on-device AI pipeline
 * only when the device cannot run the checks locally (e.g. unknown OS,
 * AsyncStorage failure, or when the question is long and warrants a
 * server-side second opinion on similarity matching).
 */
export class ValidateQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxQuestionChars()
  questionText: string;
}