import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
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
import { SubmissionLocationDto } from '@/modules/question/dto';
export class AgriEntityAlternateNameDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_AGRI_ENTITY_NAME_LENGTH)
  name: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AGRI_ENTITY_SOURCE_LENGTH)
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
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AGRI_ENTITY_SOURCE_LENGTH)
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
