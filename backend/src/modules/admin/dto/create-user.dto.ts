import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { UserCategory, UserRole } from '../../../shared/classes/enums';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  name: string;

  @IsString()
  @IsNotEmpty()
  mobileNumber: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([UserRole.USER, UserRole.ADMIN, UserRole.CURATOR, UserRole.FINANCE, UserRole.DISTRIBUTOR, UserRole.SUPER_ADMIN])
  role: UserRole;

  // Category is required only for USER role — admin/curator don't need it
  @IsOptional()
  @IsString()
  @IsIn(['farmer', 'fpo', 'student', 'volunteer', 'ngo'])
  category?: UserCategory;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  username?: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsOptional()
  @IsString()
  block?: string;

  @IsOptional()
  @IsString()
  village?: string;

  @IsOptional()
  @IsString()
  kvk?: string;

  @IsOptional()
  @IsString()
  languagePreference?: string;

  @IsOptional()
  @IsInt()
  @Min(16)
  @Max(100)
  age?: number;

  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'other'])
  gender?: string;

  @IsOptional()
  @IsString()
  farmSize?: string;

  @IsOptional()
  @IsString()
  cropType?: string;

  // Student-specific profile fields
  @IsOptional()
  @IsString()
  courseName?: string;

  @IsOptional()
  @IsString()
  collegeName?: string;

  @IsOptional()
  @IsString()
  universityName?: string;

  // Volunteer / NGO / FPO-specific profile fields
  @IsOptional()
  @IsString()
  organisationType?: string;

  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsString()
  organizationRole?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfFarmers?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  organizationState?: string[];

  @IsOptional()
  @IsString()
  organizationDistrict?: string;

  @IsOptional()
  @IsString()
  organizationBlock?: string;

  @IsOptional()
  @IsString()
  organizationVillage?: string;

  @IsOptional()
  @IsString()
  season?: string;

  @IsOptional()
  @IsString()
  volunteerCropType?: string;
}