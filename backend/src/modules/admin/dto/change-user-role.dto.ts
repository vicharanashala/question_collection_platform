import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserRole } from '../../../shared/classes/enums';

/**
 * Roles a super admin can assign through the role switch.
 * `super_admin` is intentionally not assignable here.
 */
export const ASSIGNABLE_ROLES: UserRole[] = [
  UserRole.USER,
  UserRole.ADMIN,
  UserRole.CURATOR,
  UserRole.DISTRIBUTOR,
  UserRole.FINANCE,
];

export class ChangeUserRoleDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(ASSIGNABLE_ROLES)
  role: UserRole;

  /** Optional note stored on the audit log. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
