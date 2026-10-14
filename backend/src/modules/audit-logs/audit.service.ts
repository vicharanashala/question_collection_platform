import { Injectable, Inject, ForbiddenException } from "@nestjs/common";
import { ActorType, AuditAction, UserRole } from "../../shared/classes/enums";
import { AuditLogDto, AuditStatsDto } from "./dto/audit_log-dto";
import { QueryAuditLogsDto } from "./dto/query-audit-log-dto";
import { IAuditLogRepository } from "../../shared/database/repositories/IAuditLog.repository";
import { IUserRepository } from "../../shared/database/repositories/IUser.repository";
import { REPOSITORY_TOKENS } from "../../shared/database/repositories";
import { AuditLog } from "@/shared/database/mongodb/schemas/audit-log.schema";
type ActionCategory = "withdrawal" | "user" | "question" | "config" | "auth";

const ACTION_CATEGORY: Record<string, ActionCategory> = {
  [AuditAction.USER_SUSPENDED]: "user",
  [AuditAction.USER_BANNED]: "user",
  [AuditAction.USER_UNSUSPENDED]: "user",
  [AuditAction.USER_UNBANNED]: "user",
  [AuditAction.USER_VERIFIED]: "user",
  [AuditAction.QUESTION_APPROVED]: "question",
  [AuditAction.QUESTION_REJECTED]: "question",
  [AuditAction.REWARD_CREDITED]: "withdrawal",
  [AuditAction.WITHDRAWAL_REQUESTED]: "withdrawal",
  [AuditAction.WITHDRAWAL_COMPLETED]: "withdrawal",
};

export interface AuditLogItem {
  id: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActorStats {
  actorId: string;
  actorName: string;
  actorRole: string;
  withdrawalApproved: number;
  withdrawalRejected: number;
  withdrawalProcessed: number;
  withdrawalRetried: number;
  userSuspended: number;
  userBanned: number;
  userUnsuspended: number;
  userUnbanned: number;
  userVerified: number;
  questionApproved: number;
  questionRejected: number;
  questionHeld: number;
  configUpdated: number;
  totalActions: number;
}

/** Roles that ADMIN role can view audit logs for (excludes admin/super_admin) */
const ADMIN_VIEWABLE_ROLES = [UserRole.CURATOR, UserRole.FINANCE];
/** All non-super_admin roles (what ADMIN can be assigned to view) */
const ADMIN_ASSIGNABLE_ROLES = [UserRole.CURATOR, UserRole.FINANCE];

export function buildAuditScope(user: {
  id: string;
  role: string;
}): Record<string, unknown> | null {
  switch (user.role as UserRole) {
    case UserRole.SUPER_ADMIN:
      return null; // no restriction

    case UserRole.ADMIN:
      return {
        $or: [
          { "actor.id": user.id },
          {
            "actor.actorType": {
              $in: [
                ActorType.FINANCE,
                ActorType.CURATOR,
                ActorType.DISTRIBUTOR,
              ],
            },
          },
        ],
      };

    case UserRole.CURATOR:
    case UserRole.FINANCE:
    case UserRole.DISTRIBUTOR:
      return { "actor.id": user.id };

    default:
      throw new ForbiddenException(); // deny by default
  }
}

@Injectable()
export class AuditService {
  constructor(
    @Inject(REPOSITORY_TOKENS.AuditLog)
    private readonly auditRepo: IAuditLogRepository,
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // ─── Main query ────────────────────────────────────────────────────────────

  async createAuditLog(dto: Partial<AuditLog>) {
    const data = await this.auditRepo.create(dto);
    return data;
  }

  listAuditLogs(query: QueryAuditLogsDto, user: { id: string; role: string }) {
    return this.auditRepo.findPage(query, buildAuditScope(user));
  }
}
