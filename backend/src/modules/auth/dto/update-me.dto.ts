import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  MaxLength,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateMeDto {
  // ── Basic identity ──────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  // ── Personal ────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsInt()
  @Min(1)
  age?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gender?: string;

  // ── Location ────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  block?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  village?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  kvk?: string;

  // ── Farmer ──────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(100)
  farmSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cropType?: string;

  // ── Student ─────────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(255)
  courseName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  collegeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  universityName?: string;

  // ── FPO / NGO / Volunteer ───────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(200)
  organisationType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationRole?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfFarmers?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  organizationState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  organizationDistrict?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  organizationBlock?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  organizationVillage?: string;

  // ── Volunteer ───────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(100)
  season?: string;

  // ── Preferences ─────────────────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  languagePreference?: string;

  // ── Crops (array of strings) ─────────────────────────────────────────────────
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  crops?: string[];
}