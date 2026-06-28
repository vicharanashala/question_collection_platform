import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { SystemContentType } from '../../database/entities/system-content.entity';

export class UpsertSystemContentDto {
  @IsEnum(SystemContentType)
  type: SystemContentType;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}