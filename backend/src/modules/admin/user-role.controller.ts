import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { JwtAuthGuard } from "../../shared/middleware/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/middleware/guards/roles.guard";
import { Roles } from "../../shared/middleware/decorators/roles.decorator";
import {
  ReqMeta,
  RequestMeta,
} from "../../shared/middleware/decorators/request-meta.decorator";
import { CacheInvalidate } from "../../shared/database/cache/decorators/cache-invalidate.decorator";
import {
  ActorType,
  AuditAction,
  OutcomeStatus,
  UserRole,
} from "../../shared/classes/enums";
import { AuditService } from "../audit-logs/audit.service";
import { AuditLogDto } from "../audit-logs/dto/audit_log-dto";
import { ChangeUserRoleDto } from "./dto/change-user-role.dto";
import { UserRoleService } from "./user-role.service";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    mobileNumber: string;
    role: string;
    name: string;
  };
}

@Controller("admin/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class UserRoleController {
  private readonly logger = new Logger(UserRoleController.name);

  constructor(
    private readonly userRoleService: UserRoleService,
    private readonly auditService: AuditService,
  ) {}

  /** Super admin: switch a user's role to admin, curator, distributor or finance. */
  @Patch(":id/role")
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("user:*", "admin_user:*")
  async changeUserRole(
    @Param("id") id: string,
    @Body() dto: ChangeUserRoleDto,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    const base: AuditLogDto = {
      actionType: AuditAction.USER_ROLE_CHANGED,
      actor: {
        id: req.user.id,
        actorType: ActorType.SUPER_ADMIN,
        name: req.user.name,
      },
      resource: { requestId: meta.requestId, ipAddress: meta.ipAddress },
      context: { userId: id, newRole: dto.role, reason: dto.reason },
    };

    try {
      const result = await this.userRoleService.changeRole(
        req.user.id,
        id,
        dto.role,
      );

      await this.safeAudit({
        ...base,
        context: { ...base.context, userName: result.name },
        changes: {
          before: { role: result.previousRole },
          after: { role: result.newRole },
        },
        outcome: { status: OutcomeStatus.SUCCESS },
      });

      return result;
    } catch (err) {
      await this.safeAudit({
        ...base,
        changes: { before: {}, after: {} },
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  // An audit write failing must never break the action itself.
  private async safeAudit(payload: AuditLogDto) {
    try {
      await this.auditService.createAuditLog({
        ...payload,
        changes: payload.changes ?? undefined,
        context: payload.context ?? undefined,
        outcome: payload.outcome ?? undefined,
      });
    } catch (e) {
      this.logger.error(
        "Failed to write audit log",
        e instanceof Error ? e.stack : String(e),
      );
    }
  }
}
