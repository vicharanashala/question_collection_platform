import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';
import { UserCategory } from '../../common/enums';

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

export const SUPPORTED_LANGUAGES = [
  'as', 'bn', 'brx', 'doi', 'en', 'gu', 'hi', 'kn', 'ks', 'leo',
  'mai', 'ml', 'mr', 'mni', 'ne', 'or', 'pa', 'raj', 'sa', 'sat',
  'ta', 'te', 'ur',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

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

  /** Only required for farmer category. */
  @IsOptional()
  @IsString()
  block?: string;

  /** Only required for farmer category. */
  @IsOptional()
  @IsString()
  village?: string;

  /** Only required for farmer category. */
  @IsOptional()
  @IsString()
  kvk?: string;

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

  @IsNotEmpty()
  @IsEnum(UserCategory)
  category: UserCategory;

  // ── Farmer-specific ─────────────────────────────────────────────────────────

  /** Farm size in acres — farmer only. */
  @IsOptional()
  @IsString()
  farmSize?: string;

  /** Primary crop — farmer only. */
  @IsOptional()
  @IsString()
  cropType?: string;

  // ── Student-specific ────────────────────────────────────────────────────────

  /** Course name — student only. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  courseName?: string;

  /** College name — student only. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  collegeName?: string;

  /** University name — student only. */
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

  /** Organisation name — fpo / ngo / volunteer. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationName?: string;

  /** Role within the organisation — fpo / ngo / volunteer. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationRole?: string;

  // ── Volunteer ───────────────────────────────────────────────────────────────

  /** Season — volunteer (gardening season) only. */
  @IsOptional()
  @IsString()
  season?: string;

  /** Primary crop — volunteer only. */
  @IsOptional()
  @IsString()
  volunteerCropType?: string;

  @IsNotEmpty()
  @IsString()
  languagePreference: string;

  /** Must be explicitly `true` — validated again in the auth service. */
  @IsBoolean()
  consentGiven: boolean;
}