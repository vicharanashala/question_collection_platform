import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserCategory } from '../../common/enums';

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
}

export class CropDetailDto {
  @IsNotEmpty()
  @IsString()
  cropName: string;

  @IsOptional()
  @IsString()
  season?: string; // kharif | rabi | zaid | year_round
}

export class UpdateCropDetailsDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CropDetailDto)
  crops?: CropDetailDto[];
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