import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
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
  @IsIn([
    UserRole.USER,
    UserRole.ADMIN,
    UserRole.CURATOR,
    UserRole.FINANCE,
    UserRole.DISTRIBUTOR,
    UserRole.SUPER_ADMIN,
  ])
  role: UserRole;

  /** Required by the service only when role is USER. */
  @IsOptional()
  @IsString()
  @IsIn([
    UserCategory.FARMER,
    UserCategory.FPO,
    UserCategory.STUDENT,
    UserCategory.VOLUNTEER,
    UserCategory.NGO,
  ])
  category?: UserCategory;

  @IsBoolean()
  isUserCreatedBySuperAdmin: boolean
}