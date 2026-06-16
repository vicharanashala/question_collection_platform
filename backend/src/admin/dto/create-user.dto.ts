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

  @IsString()
  @IsIn(['farmer', 'fpo', 'student', 'volunteer', 'ngo'])
  category: UserCategory;

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
  languagePreference?: string;
}