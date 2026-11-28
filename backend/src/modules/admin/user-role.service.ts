import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Types } from "mongoose";
import { UserRole } from "../../shared/classes/enums";
import { REPOSITORY_TOKENS } from "../../shared/database/repositories";
import { IUserRepository } from "../../shared/database/repositories/IUser.repository";
import { SessionService } from "../session/session.service";
import { ASSIGNABLE_ROLES } from "./dto/change-user-role.dto";

export interface ChangeUserRoleResult {
  success: true;
  userId: string;
  name: string;
  previousRole: UserRole;
  newRole: UserRole;
}

@Injectable()
export class UserRoleService {
  private readonly logger = new Logger(UserRoleService.name);

  constructor(
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Switches a user's role. Super admin only.
   *
   * The role is baked into the access token, so after the change the user's
   * token version is bumped and their session is ended. They sign in again and
   * pick up the new role.
   */
  async changeRole(
    actorId: string,
    userId: string,
    newRole: UserRole,
  ): Promise<ChangeUserRoleResult> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException("Invalid user id");
    }

    const actor = await this.userRepo.findOne({ where: { id: actorId } });
    if (!actor || actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Only super admins can change user roles");
    }

    if (actorId === userId) {
      throw new BadRequestException("You cannot change your own role");
    }

    if (!ASSIGNABLE_ROLES.includes(newRole)) {
      throw new BadRequestException(
        `Role must be one of: ${ASSIGNABLE_ROLES.join(", ")}`,
      );
    }

    const target = await this.userRepo.findOne({ where: { id: userId } });
    if (!target) throw new NotFoundException("User not found");
    if (target.isDeleted) {
      throw new BadRequestException(
        "This user is deleted. Restore the user before changing their role",
      );
    }
    if (target.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("The role of a super admin cannot be changed");
    }
    if (target.role === newRole) {
      throw new BadRequestException(`User already has the ${newRole} role`);
    }

    const previousRole = target.role as UserRole;

    await this.userRepo.update(userId, {
      role: newRole,
      // Invalidates every token issued with the old role
      tokenVersion: (target.tokenVersion ?? 0) + 1,
    });

    // Force a fresh login so the new role is picked up. A failure here must not
    // turn a saved role change into an error, the token version bump above
    // already invalidates the old tokens.
    try {
      await this.sessionService.revokeUser(userId);
    } catch (err) {
      this.logger.error(
        `Role changed for ${userId} but session revoke failed`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return {
      success: true,
      userId,
      name: target.name,
      previousRole,
      newRole,
    };
  }
}
