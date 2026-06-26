import { IsString, IsNotEmpty, IsOptional, IsIn, MinLength } from 'class-validator';
import { UserCategory, UserRole } from '../../common/enums';

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
  @IsIn([UserRole.USER, UserRole.ADMIN, UserRole.CURATOR])
  role: UserRole;

  // Category is required only for USER role — admin/curator don't need it
  @IsOptional()
  @IsString()
  @IsIn(['farmer', 'fpo', 'student', 'volunteer', 'ngo'])
  category?: UserCategory;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  block: string;

  @IsString()
  @IsNotEmpty()
  village: string;

  @IsOptional()
  @IsString()
  kvk?: string;

  @IsOptional()
  @IsString()
  languagePreference?: string;

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
}