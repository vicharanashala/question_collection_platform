import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Update Config ─────────────────────────────────────────────────────────────────

export class UpdateConfigDto {
  @IsString()
  key: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  value: number;

  @IsOptional()
  @IsString()
  description?: string;
}

// ── Create Config ─────────────────────────────────────────────────────────────────

export class CreateConfigDto {
  @IsString()
  key: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  value: number;

  @IsOptional()
  @IsString()
  description?: string;
}