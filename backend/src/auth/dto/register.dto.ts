import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserCategory } from '../../common/enums';

// Supported Indian states (abbreviated list)
export const SUPPORTED_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry',
] as const;

export type SupportedState = typeof SUPPORTED_STATES[number];

// 22 Indian languages + English
export const SUPPORTED_LANGUAGES = [
  'as', 'bn', 'brx', 'doi', 'en', 'gu', 'hi', 'kn', 'ks', 'leo',
  'mai', 'ml', 'mr', 'mni', 'ne', 'or', 'pa', 'raj', 'sa', 'sat',
  'ta', 'te', 'ur',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Farmer-specific profile fields
export class FarmerProfileDto {
  @IsOptional()
  @IsString()
  farmSize?: string; // e.g. "2.5 acres"

  @IsOptional()
  @IsString()
  cropType?: string;
}

// Student-specific profile fields
export class StudentProfileDto {
  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  universityName?: string;
}

// FPO-specific profile fields
export class FpoProfileDto {
  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

// Volunteer/NGO-specific profile fields
export class VolunteerProfileDto {
  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  mobileNumber: string;

  @IsNotEmpty()
  @IsString()
  state: string;

  @IsNotEmpty()
  @IsString()
  district: string;

  @IsNotEmpty()
  @IsString()
  block: string;

  @IsNotEmpty()
  @IsString()
  village: string;

  @IsOptional()
  @IsString()
  kvk?: string;

  @IsNotEmpty()
  @IsEnum(UserCategory)
  category: UserCategory;

  @IsNotEmpty()
  @IsString()
  languagePreference: string; // language code e.g. 'hi', 'mr', 'ta'

  /** Must be explicitly `true` — validated again in the auth service */
  @IsBoolean()
  consentGiven: boolean;

  @IsOptional()
  profileData?: FarmerProfileDto | StudentProfileDto | FpoProfileDto | VolunteerProfileDto;
}