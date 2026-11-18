import { UserRole } from "../../../shared/classes/enums";
import { IUserRepository } from "../../../shared/database/repositories";

// Returns true when the given user id belongs to a super admin.
export async function isSuperAdminUser(userRepo: IUserRepository, adminId: string): Promise<boolean> {
  const admin = await userRepo.findOne({ id: adminId });
  return admin?.role === UserRole.SUPER_ADMIN;
}
