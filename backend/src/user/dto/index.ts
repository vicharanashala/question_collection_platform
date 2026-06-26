import {
  IsString,
  IsOptional,
  IsArray,
  MinLength,
  MaxLength,
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
  languagePreference?: string;

  /**
   * Arbitrary profile fields stored in the user.profileData JSONB column.
   * Accepted keys: farmSize, cropType, courseName, universityName,
   * organisationName, memberRole, and any future category-specific fields.
   */
  @IsOptional()
  @IsString()
  farmSize?: string;

  @IsOptional()
  @IsString()
  cropType?: string;

  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  universityName?: string;

  @IsOptional()
  @IsString()
  organisationName?: string;

  @IsOptional()
  @IsString()
  memberRole?: string;

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