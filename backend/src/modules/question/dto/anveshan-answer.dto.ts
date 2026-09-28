import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { AnveshanAnswerSourceType } from '../../../shared/database/entities';

export const ANVESHAN_ANSWER_SOURCE_TYPES: AnveshanAnswerSourceType[] = ['hyper_local', 'state', 'central', 'other'];
export const MIN_ANVESHAN_ANSWER_LENGTH = 500;
export const MAX_ANVESHAN_ANSWER_LENGTH = 5000;
export const MAX_ANVESHAN_REMARKS_LENGTH = 1000;
export const MAX_ANVESHAN_ANSWER_SOURCES = 10;
const MAX_SOURCE_NAME_LENGTH = 200;
const MAX_SOURCE_URL_LENGTH = 2000;

// Comma separated positive page numbers, for example "4" or "1,2,3".
const PAGE_LIST_PATTERN = /^\s*[1-9]\d*\s*(,\s*[1-9]\d*\s*)*$/;
// Same PDF detection the expert review screen uses: a page number is required for these links.
const PDF_LINK_PATTERN = /pdf/i;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const hasValue = (_: object, value: unknown) => value !== undefined && value !== null && value !== '';

export class AnveshanAnswerSourceDto {
  @IsIn(ANVESHAN_ANSWER_SOURCE_TYPES)
  sourceType: AnveshanAnswerSourceType;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Source name is required' })
  @MaxLength(MAX_SOURCE_NAME_LENGTH)
  sourceName: string;

  @Transform(trim)
  @IsString()
  @MaxLength(MAX_SOURCE_URL_LENGTH)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_tld: true },
    { message: 'Each source must be a public web link starting with http:// or https:// (for example https://agritech.tnau.ac.in/…)' },
  )
  source: string;

  @Transform(trim)
  @ValidateIf((dto: AnveshanAnswerSourceDto, value) => hasValue(dto, value) || PDF_LINK_PATTERN.test(dto.source ?? ''))
  @IsString({ message: 'Page number is required for PDF links' })
  @Matches(PAGE_LIST_PATTERN, { message: 'Page must be one or more page numbers, for example 1 or 1,2,3' })
  page?: string;
}

export class SubmitAnveshanAnswerDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Answer is required' })
  @MinLength(MIN_ANVESHAN_ANSWER_LENGTH, { message: `Answer must be at least ${MIN_ANVESHAN_ANSWER_LENGTH} characters` })
  @MaxLength(MAX_ANVESHAN_ANSWER_LENGTH)
  answer: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one source is required' })
  @ArrayMaxSize(MAX_ANVESHAN_ANSWER_SOURCES)
  @ValidateNested({ each: true })
  @Type(() => AnveshanAnswerSourceDto)
  sources: AnveshanAnswerSourceDto[];

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ANVESHAN_REMARKS_LENGTH)
  remarks?: string;
}
