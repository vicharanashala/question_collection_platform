import {
  IsString,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
  IsInt,
  Min,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  block?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  village?: string;

  @IsOptional()
  @IsString()
  languagePreference?: string;

  // ── General ─────────────────────────────────────────────────────────────────

  /** Age — applicable to all categories. */
  @IsOptional()
  @IsInt()
  @Min(1)
  age?: number;

  /** Gender — applicable to all categories. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  gender?: string;

  // ── Farmer ──────────────────────────────────────────────────────────────────

  @IsOptional()
  @IsString()
  farmSize?: string;

  @IsOptional()
  @IsString()
  cropType?: string;

  @IsOptional()
  @IsString()
  season?: string;

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

  /** Organisation type — fpo / ngo / volunteer. */
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

  /** Number of farmers under this FPO/NGO — fpo / ngo only. */
  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfFarmers?: number;

  /** Crop names to associate with the user (replaces existing list). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  crops?: string[];
}

/**
 * DTO for replacing the user's full crop list.
 * Crops are stored as a simple text[] on the user record — no season, no separate table.
 */
export class UpdateCropDetailsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  crops?: string[];
}

export const SUPPORTED_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
] as const;