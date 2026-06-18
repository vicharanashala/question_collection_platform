import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  questionText?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  domains?: string[];

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