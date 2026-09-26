import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AgriEntityType } from '../../../shared/classes/enums';
import { NormalizeMediaUrls } from '../../../shared/middleware/transformers/normalize-media-urls.transformer';
import {
  MAX_AGRI_ENTITY_ALTERNATE_NAMES,
  MAX_AGRI_ENTITY_IMAGES,
  MAX_AGRI_ENTITY_NAME_LENGTH,
  MAX_AGRI_ENTITY_SOURCE_LENGTH,
} from '../agri-entities.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

// Sources are optional, so URL rules apply only when a value is provided.
const hasValue = (_: object, value: unknown) => value !== undefined && value !== null && value !== '';
const SOURCE_URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true, require_tld: true };
const SOURCE_URL_MESSAGE = '$property must be a valid URL starting with http:// or https://';
import { SubmissionLocationDto } from '@/modules/question/dto';
export class AgriEntityAlternateNameDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_AGRI_ENTITY_NAME_LENGTH)
  name: string;

  @Transform(trim)
  @ValidateIf(hasValue)
  @IsString()
  @MaxLength(MAX_AGRI_ENTITY_SOURCE_LENGTH)
  @IsUrl(SOURCE_URL_OPTIONS, { message: SOURCE_URL_MESSAGE })
  source?: string;
}

export class SubmitAgriEntityDto {
  @IsEnum(AgriEntityType)
  type: AgriEntityType;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_AGRI_ENTITY_NAME_LENGTH)
  localName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_AGRI_ENTITY_NAME_LENGTH)
  englishName: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_AGRI_ENTITY_NAME_LENGTH)
  botanicalName: string;

  @Transform(trim)
  @ValidateIf(hasValue)
  @IsString()
  @MaxLength(MAX_AGRI_ENTITY_SOURCE_LENGTH)
  @IsUrl(SOURCE_URL_OPTIONS, { message: SOURCE_URL_MESSAGE })
  localNameSource?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_AGRI_ENTITY_ALTERNATE_NAMES)
  @ValidateNested({ each: true })
  @Type(() => AgriEntityAlternateNameDto)
  alternateNames: AgriEntityAlternateNameDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_AGRI_ENTITY_IMAGES)
  @IsString({ each: true })
  @NormalizeMediaUrls()
  imageUrls: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SubmissionLocationDto)
  submissionLocation?: SubmissionLocationDto;
}

export interface SubmitAgriEntityResponseDto {
  id: string;
  status: string;
  message: string;
}
