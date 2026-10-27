import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Response, Request } from "express";
import { AdminService } from "./admin.service";
import {
  ListUsersDto,
  ListUserStatsDto,
  ListReviewQueueDto,
  ReviewActionDto,
  UpdateConfigDto,
  CreateConfigDto,
  AnalyticsQueryDto,
  ExportQueryDto,
  ListWithdrawalsDto,
  ProcessWithdrawalDto,
  MarkWithdrawalFailedDto,
  UpdateWithdrawalFailureReasonDto,
  CreateUserDto,
  SuspendUserDto,
  ListAllWalletsDto,
  ListUserTransactionsDto,
  ListUserWithdrawalsDto,
  AdjustWalletDto,
} from "./dto";
import { JwtAuthGuard } from "../../shared/middleware/guards/jwt-auth.guard";
import { RolesGuard } from "../../shared/middleware/guards/roles.guard";
import { Roles } from "../../shared/middleware/decorators/roles.decorator";
import {
  ActorType,
  AuditAction,
  OutcomeStatus,
  UserRole,
} from "../../shared/classes/enums";
import { CacheInvalidate } from "../../shared/database/cache/decorators/cache-invalidate.decorator";
import { Cacheable } from "../../shared/database/cache/decorators/cacheable.decorator";
import { AuditService } from "../audit-logs/audit.service";
import {
  ReqMeta,
  RequestMeta,
} from "@/shared/middleware/decorators/request-meta.decorator";
import { AuditLogDto } from "../audit-logs/dto/audit_log-dto";
import { UserService } from "../user/user.service";
import { Types } from "mongoose";
import { SessionService } from "../session/session.service";

type AuditLogPayload = Parameters<AuditService["createAuditLog"]>[0];

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    mobileNumber: string;
    role: string;
    name: string;
  };
}

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
    private readonly logger: Logger = new Logger(AdminController.name),
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Section 1: User Management — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Post("users")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.CREATED)
  @CacheInvalidate("analytics:*", "hot:*")
  async createUser(
    @Body() dto: CreateUserDto,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    const base: AuditLogDto = {
      actionType: AuditAction.USER_CREATED,
      actor: {
        id: req.user.id,
        actorType: ActorType.SUPER_ADMIN,
        name: req.user.name,
      },
      resource: {
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
      },
      context: {
        name: dto.name,
        role: dto.role,
        mobilePhone: dto.mobileNumber,
        category: dto.category ? dto.category : null,
      },
    };
    let result;
    try {
      result = await this.adminService.createUser(
        req.user.id,
        req.user.role as UserRole,
        dto,
      );
    } catch (err) {
      await this.safeAudit({
        ...base,
        changes: {
          before: {},
          after: {},
        },
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
    await this.safeAudit({
      ...base,
      changes: {
        before: {},
        after: { id: result?.user.id },
      },
      outcome: { status: OutcomeStatus.SUCCESS },
    });

    return result;
  }

  @Get("users")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  async listUsers(
    @Query() dto: ListUsersDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const result = await this.adminService.listUsers(dto);

    const sessions = await this.sessionService.getActiveSessionMap(
      result.items.map((u) => u.id),
    );
    const isSuperAdmin = req.user.role === UserRole.SUPER_ADMIN;

    return {
      ...result,
      items: result.items.map((u) => {
        const s = sessions.get(u.id);
        return {
          ...u,
          isActive: !!s,
          lastActivityAt: s?.lastActivityAt ?? null,
          // device details only for Super Admins
          ...(isSuperAdmin &&
            s && {
              session: { browser: s.browser, os: s.os, device: s.device },
            }),
        };
      }),
    };
  }

  @Get("users/stats")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable("admin_users_stats", 60)
  async getUserStats(@Query() dto: ListUserStatsDto) {
    return this.adminService.getUserStats(dto);
  }

  @Get("users/:id")
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.FINANCE,
    UserRole.CURATOR,
    UserRole.DISTRIBUTOR,
  )
  @HttpCode(HttpStatus.OK)
  @Cacheable((args) => `admin_user:${args[0]}`, 120)
  async getUserDetail(@Param("id") id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Post("users/:id/suspend")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("user:*")
  async suspendUser(
    @Param("id") id: string,
    @Body() body: SuspendUserDto,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    const role = req.user.role as UserRole;
    const base: AuditLogDto = {
      actionType:
        body.action === "ban"
          ? AuditAction.USER_BANNED
          : AuditAction.USER_SUSPENDED,
      actor: {
        id: req.user.id,
        actorType:
          role === UserRole.SUPER_ADMIN
            ? ActorType.SUPER_ADMIN
            : role === UserRole.ADMIN
              ? ActorType.ADMIN
              : ActorType.FINANCE,
        name: req.user.name,
      },
      resource: {
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
      },
      context: {
        userId: id,
        reason: body.reason,
        timePeriod: body.suspendedUntil,
      },
    };
    let result;
    try {
      result = await this.adminService.suspendOrBanUser(
        req.user.id,
        id,
        body.action,
        body.reason,
        body.suspendedUntil,
      );
    } catch (err) {
      await this.safeAudit({
        ...base,
        changes: {
          before: {
            status: body.action === "suspend" ? "unsuspended" : "unbanned",
          },
          after: {
            status: body.action === "suspend" ? "unsuspended" : "unbanned",
          },
        },
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }

    await this.safeAudit({
      ...base,
      changes: {
        before: {
          status: body.action === "suspend" ? "unsuspended" : "unbanned",
        },
        after: { status: body.action === "suspend" ? "suspended" : "banned" },
      },
      outcome: { status: OutcomeStatus.SUCCESS },
    });

    // A suspended or banned user must not keep an active session
    await this.revokeSessionQuietly(id);

    return result;
  }

  @Post("users/:id/unsuspend")
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("user:*")
  async unsuspendUser(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    const role = req.user.role as UserRole;
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid user id");
    }
    const user = await this.userService.getProfile(new Types.ObjectId(id));
    const base: AuditLogDto = {
      actionType:
        user.verificationStatus === "suspended"
          ? AuditAction.USER_UNSUSPENDED
          : AuditAction.USER_UNBANNED,
      actor: {
        id: req.user.id,
        actorType:
          role === UserRole.SUPER_ADMIN
            ? ActorType.SUPER_ADMIN
            : role === UserRole.ADMIN
              ? ActorType.ADMIN
              : ActorType.FINANCE,
        name: req.user.name,
      },
      resource: {
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
      },
      context: {
        userId: id,
      },
    };
    let result;
    try {
      result = await this.adminService.unsuspendOrUnbanUser(req.user.id, id);
    } catch (err) {
      await this.safeAudit({
        ...base,
        changes: {
          before: {
            status:
              user.verificationStatus === "suspended" ? "suspended" : "banned",
          },
          after: {
            status:
              user.verificationStatus === "suspended" ? "suspended" : "banned",
          },
        },
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
    await this.safeAudit({
      ...base,
      changes: {
        before: {
          status:
            user.verificationStatus === "suspended" ? "suspended" : "banned",
        },
        after: {
          status:
            user.verificationStatus === "suspended"
              ? "unsuspended"
              : "unbanned",
        },
      },
      outcome: { status: OutcomeStatus.SUCCESS },
    });

    return result;
  }

  @Post("users/:id/verify")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("user:*")
  async verifyUser(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    const role = req.user.role;
    const base: AuditLogDto = {
      actionType: AuditAction.USER_VERIFIED,
      actor: {
        id: req.user.id,
        actorType:
          role === UserRole.SUPER_ADMIN
            ? ActorType.SUPER_ADMIN
            : role === UserRole.ADMIN
              ? ActorType.ADMIN
              : ActorType.FINANCE,
        name: req.user.name,
      },
      resource: {
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
      },
      context: {
        userId: id,
      },
    };

    let result;
    try {
      result = await this.adminService.verifyUser(req.user.id, id);
    } catch (err) {
      await this.safeAudit({
        ...base,
        changes: {
          before: {
            status: "unverified",
          },
          after: {
            status: "unverified",
          },
        },
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
    await this.safeAudit({
      ...base,
      changes: {
        before: {
          status: "unverified",
        },
        after: {
          status: "verified",
        },
      },
      outcome: {
        status: OutcomeStatus.SUCCESS,
      },
    });
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Section 2: Question Review — curator read-only (queue + metrics only)
  // ─────────────────────────────────────────────────────────────

  @Get("questions/queue")
  @HttpCode(HttpStatus.OK)
  @Cacheable("review_queue", 60)
  async listReviewQueue(@Query() dto: ListReviewQueueDto) {
    return this.adminService.listReviewQueue(dto);
  }

  /** Question quality and volume metrics — curator read-only */
  @Get("questions/metrics")
  @HttpCode(HttpStatus.OK)
  @Cacheable("question_metrics", 120)
  async getQuestionMetrics(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getQuestionMetrics(dto);
  }

  @Get("questions/:id")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable((args) => `admin_question:${args[0]}`, 120)
  async getQuestion(@Param("id") id: string) {
    return this.adminService.getQuestionForReview(id);
  }

  /**
   * Check whether a question in the curator queue is a duplicate.
   * Runs exact-match (DB) + GDB semantic search — same logic as question submission.
   * Returns { isDuplicate, matchedQuestion, matchedAnswer, similarityScore, matchedUserName }.
   */
  @Post("questions/:id/check-duplicate")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR)
  @HttpCode(HttpStatus.OK)
  async checkDuplicate(@Param("id") id: string) {
    return this.adminService.checkDuplicate(id);
  }

  @Post("questions/:id/review")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("leaderboard:top_users", "hot:*", "analytics:*")
  async reviewQuestion(
    @Param("id") id: string,
    @Body() dto: ReviewActionDto,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    const role = req.user.role as UserRole;

    const base: AuditLogDto = {
      actionType:
        dto.action === "approve"
          ? AuditAction.QUESTION_APPROVED
          : dto.action === "hold"
            ? AuditAction.HOLD_QUESTION
            : dto.action === "reject"
              ? AuditAction.QUESTION_REJECTED
              : AuditAction.REQUEST_INFO,
      actor: {
        id: req.user.id,
        actorType:
          role === UserRole.SUPER_ADMIN
            ? ActorType.SUPER_ADMIN
            : role === UserRole.ADMIN
              ? ActorType.ADMIN
              : ActorType.CURATOR,
        name: req.user.name,
      },
      resource: {
        requestId: meta.requestId,
        ipAddress: meta.ipAddress,
      },
    };

    let result;
    try {
      result = await this.adminService.reviewQuestion(
        req.user.id,
        id,
        dto,
        role,
      );
    } catch (err) {
      await this.safeAudit({
        ...base,
        context: { questionId: id, reason: dto.reason },
        changes: {
          before: { status: "pending" },
          after: { status: "pending" },
        },
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err; // keep the real HTTP error
    }

    await this.safeAudit({
      ...base,
      context: { questionId: id, reason: dto.reason },
      changes: {
        before: { status: "pending" },
        after: { status: dto.action === "approve" ? "approved" : "rejected" },
      },
      outcome: { status: OutcomeStatus.SUCCESS },
    });

    return result;
  }

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

  // Maps a staff role to the actor type stored on audit logs.
  private toActorType(role: UserRole): ActorType {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return ActorType.SUPER_ADMIN;
      case UserRole.ADMIN:
        return ActorType.ADMIN;
      case UserRole.FINANCE:
        return ActorType.FINANCE;
      case UserRole.DISTRIBUTOR:
        return ActorType.DISTRIBUTOR;
      default:
        return ActorType.CURATOR;
    }
  }

  // Runs a staff action and records a success or failure audit log for it.
  private async withAudit<T>(
    actionType: AuditAction,
    req: AuthenticatedRequest,
    meta: RequestMeta,
    context: Record<string, unknown>,
    run: () => Promise<T>,
    snapshot?: {
      before?: () => Promise<Record<string, unknown> | null>;
      after?: (result: T) => Promise<Record<string, unknown> | null>;
    },
  ): Promise<T> {
    const base: AuditLogDto = {
      actionType,
      actor: {
        id: req.user.id,
        name: req.user.name,
        actorType: this.toActorType(req.user.role as UserRole),
      },
      resource: { requestId: meta.requestId, ipAddress: meta.ipAddress },
      context,
    };

    // Snapshot failures must never block the real action
    const safely = async <V>(fn?: () => Promise<V>) => {
      try {
        return fn ? await fn() : undefined;
      } catch (err) {
        this.logger.warn(`Audit snapshot failed: ${err}`);
        return undefined;
      }
    };

    const before = await safely(snapshot?.before);

    try {
      const result = await run();
      const after = await safely(
        snapshot?.after ? () => snapshot.after!(result) : undefined,
      );
      await this.safeAudit({
        ...base,
        changes: { before: before ?? {}, after: after ?? {} },
        outcome: { status: OutcomeStatus.SUCCESS },
      });
      return result;
    } catch (err) {
      await this.safeAudit({
        ...base,
        changes: { before: before ?? {}, after: {} },
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Section 3: Configuration — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Get("config")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable("config", 300)
  async listConfig() {
    return this.adminService.listConfig();
  }

  // @Post("config")
  // @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  // @HttpCode(HttpStatus.CREATED)
  // @CacheInvalidate("meta:*")
  // async createConfig(
  //   @Body() dto: CreateConfigDto,
  //   @Req() req: AuthenticatedRequest,
  // ) {
  //   let result;
  //   result=  this.adminService.createConfig(req.user.id, dto);
  //   return result;
  // }

  @Patch("config")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("meta:*", "hot:reward_tiers")
  async updateConfig(
    @Body() dto: UpdateConfigDto,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    const base: AuditLogDto = {
      actionType: AuditAction.CONFIG_UPDATED,
      actor: {
        id: req.user.id,
        actorType: ActorType.SUPER_ADMIN,
        name: req.user.name,
      },
      resource: { requestId: meta.requestId, ipAddress: meta.ipAddress },
      context: { key: dto.key, description: dto.description },
    };

    let before: unknown = null;
    let result;
    try {
      const { items } = await this.adminService.listConfig();
      before = items.find((c) => c.key === dto.key)?.value ?? null;

      result = await this.adminService.updateConfig(req.user.id, dto);
    } catch (err) {
      await this.safeAudit({
        ...base,
        changes: { before: { value: before }, after: { value: before } }, // unchanged
        outcome: {
          status: OutcomeStatus.FAILURE,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
      throw err;
    }

    await this.safeAudit({
      ...base,
      changes: { before: { value: before }, after: { value: dto.value } },
      outcome: { status: OutcomeStatus.SUCCESS },
    });

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Section 4: Analytics Dashboard
  // ─────────────────────────────────────────────────────────────

  /** Curator-only dashboard: question volume, approval rates, daily trends, and queue depth. */
  @Get("analytics/curator-dashboard")
  @Roles(
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.CURATOR,
    UserRole.FINANCE,
  )
  @HttpCode(HttpStatus.OK)
  @Cacheable("curator_dashboard", 60)
  async getCuratorDashboard(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getCuratorDashboard(dto);
  }

  @Get("analytics/dashboard")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable("dashboard", 60)
  async getDashboard(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getDashboardStats(dto);
  }

  /** Full stats for the admin dashboard */
  @Get("stats")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Cacheable("admin_stats", 60)
  async getStats(@Query() dto: AnalyticsQueryDto) {
    const data = await this.adminService.getStats(dto);
    return data;
  }

  @Get("analytics/rewards")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable("reward_summary", 120)
  async getRewardSummary(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getRewardSummary(dto);
  }

  @Get("analytics/reward-logs")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable("reward_logs", 60)
  async getRewardLogs(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.listRewardLogs(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 5: Fraud — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Get("fraud")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable("fraud_stats", 60)
  async getFraudStats(
    @Query() dto: { page?: number; limit?: number; state?: string },
  ) {
    return this.adminService.getFraudStats(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 6: Wallets — curator blocked
  // ─────────────────────────────────────────────────────────────

  /** List all wallets with user info, filterable by search/state/sort */
  @Get("wallets")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable("admin_wallets", 60)
  async listAllWallets(@Query() dto: ListAllWalletsDto) {
    return this.adminService.listAllWallets(dto);
  }

  /** Get a single user's wallet + user details */
  @Get("wallets/user/:userId")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable((args) => `admin_wallet:${args[0]}`, 60)
  async getUserWallet(@Param("userId") userId: string) {
    return this.adminService.getUserWallet(userId);
  }

  /** Full transaction history for a specific user */
  @Get("wallets/user/:userId/transactions")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable((args) => `admin_user_transactions:${args[0]}`, 60)
  async listUserTransactions(
    @Param("userId") userId: string,
    @Query() dto: ListUserTransactionsDto,
  ) {
    return this.adminService.listUserTransactions(userId, dto);
  }

  /** Withdrawal history for a specific user */
  @Get("wallets/user/:userId/withdrawals")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable((args) => `admin_user_withdrawals:${args[0]}`, 60)
  async listUserWithdrawals(
    @Param("userId") userId: string,
    @Query() dto: ListUserWithdrawalsDto,
  ) {
    return this.adminService.listUserWithdrawals(userId, dto);
  }

  /** Super admin: manually credit or debit a user's wallet */
  @Post("wallets/adjust")
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("wallet:*")
  async adjustWalletBalance(
    @Body() dto: AdjustWalletDto,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.withAudit(
      AuditAction.WALLET_ADJUSTED,
      req,
      meta,
      { userId: dto.userId, amount: dto.amount, reason: dto.reason },
      () => this.adminService.adjustWalletBalance(req.user.id, dto),
    );
  }

  /** Financial summary stats for the finance role dashboard */
  @Get("analytics/financial-summary")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable("financial_summary", 60)
  async getFinancialSummary(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getFinancialSummary(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 6b: Withdrawals — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Get("withdrawals")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable("withdrawals_list", 60)
  async listWithdrawals(@Query() dto: ListWithdrawalsDto) {
    return this.adminService.listWithdrawals(dto);
  }

  @Get("withdrawals/:id")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable((args) => `admin_withdrawal:${args[0]}`, 60)
  async getWithdrawalWithTransactions(@Param("id") id: string) {
    return this.adminService.getWithdrawalWithTransactions(id);
  }

  @Post("withdrawals/:id/process")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("wallet:*")
  async processWithdrawal(
    @Param("id") id: string,
    @Body() dto: ProcessWithdrawalDto,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.withAudit(
      AuditAction.WITHDRAWAL_PROCESSED,
      req,
      meta,
      {
        withdrawalId: id,
        decision: dto.action,
        rejectionReason: dto.rejectionReason,
      },
      () =>
        this.adminService.processWithdrawal(
          req.user.id,
          id,
          dto,
          req.user.role as UserRole,
        ),
    );
  }

  /** Retry a failed PineLabs payout for a PROCESSING withdrawal */
  @Post("withdrawals/:id/retry")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("wallet:*")
  async retryWithdrawal(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.withAudit(
      AuditAction.WITHDRAWAL_RETRIED,
      req,
      meta,
      { withdrawalId: id },
      () => this.adminService.retryWithdrawal(req.user.id, id),
    );
  }

  /**
   * Retry a failed withdrawal that was already refunded.
   * Resets the withdrawal to PROCESSING, creates a new DEBIT transaction,
   * re-attempts the PineLabs payout, and re-refunds if it fails again.
   */
  @Post("withdrawals/:id/retry-refund")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("wallet:*")
  async retryFailedWithdrawal(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.withAudit(
      AuditAction.WITHDRAWAL_REFUND_RETRIED,
      req,
      meta,
      { withdrawalId: id },
      () => this.adminService.retryFailedWithdrawal(req.user.id, id),
    );
  }

  /** Admin explicitly marks a PROCESSING withdrawal as FAILED and refunds the user */
  @Post("withdrawals/:id/fail")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("wallet:*")
  async markWithdrawalFailed(
    @Param("id") id: string,
    @Body() dto: MarkWithdrawalFailedDto,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.withAudit(
      AuditAction.WITHDRAWAL_FAILED,
      req,
      meta,
      { withdrawalId: id, reason: dto.reason },
      () => this.adminService.markWithdrawalFailed(req.user.id, id, dto.reason),
    );
  }

  /** Admin updates the failure reason on an already-failed withdrawal */
  @Patch("withdrawals/:id/failure-reason")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate("wallet:*")
  async updateWithdrawalFailureReason(
    @Param("id") id: string,
    @Body() dto: UpdateWithdrawalFailureReasonDto,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.withAudit(
      AuditAction.WITHDRAWAL_FAILURE_REASON_UPDATED,
      req,
      meta,
      { withdrawalId: id, reason: dto.reason },
      () =>
        this.adminService.updateWithdrawalFailureReason(
          req.user.id,
          id,
          dto.reason,
        ),
    );
  }

  /** Super admin only: flush cache keys matching a pattern. */
  @Post("cache/flush")
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async flushCache(
    @Body() body: { keyPattern: string },
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    if (!body.keyPattern || !body.keyPattern.trim()) {
      throw new BadRequestException("keyPattern is required");
    }
    const keyPattern = body.keyPattern.trim();
    return this.withAudit(
      AuditAction.CACHE_FLUSHED,
      req,
      meta,
      { keyPattern },
      () => this.adminService.flushCache(keyPattern),
    );
  }

@Post("delete-user/:id")
@Roles(UserRole.SUPER_ADMIN)
@HttpCode(HttpStatus.OK)
async deleteUser(
  @Param("id") id: string,
  @Req() req: AuthenticatedRequest,
  @ReqMeta() meta: RequestMeta,
) {
  return this.withAudit(
    AuditAction.USER_DELETED,
    req,
    meta,
    { userId: id },
    async () => {
      const result = await this.adminService.deleteUser(id);
      // Only runs if the delete succeeded. A failed delete (for example pending
      // withdrawals) throws above and the user keeps their session.
      await this.revokeSessionQuietly(id);
      return result;
    },
    {
      before: () => this.adminService.getUserAuditSnapshot(id),
      after: () => this.adminService.getUserAuditSnapshot(id),
    },
  );
}

// Session cleanup must not turn a successful action into an error response.
private async revokeSessionQuietly(userId: string) {
  try {
    await this.sessionService.revokeUser(userId);
  } catch (err) {
    this.logger.error(
      `Failed to revoke session for ${userId}`,
      err instanceof Error ? err.stack : String(err),
    );
  }
}

  @Post("restore-user/:id")
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async restoreUser(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.withAudit(
      AuditAction.USER_RESTORED,
      req,
      meta,
      { userId: id },
      () => this.adminService.restoreUser(id),
      {
        before: () => this.adminService.getUserAuditSnapshot(id),
        after: () => this.adminService.getUserAuditSnapshot(id),
      },
    );
  }

  @Post("users/:id/revoke-session")
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async revokeUserSession(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
    @ReqMeta() meta: RequestMeta,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid user id");
    }
    if (id === req.user.id) {
  throw new BadRequestException("Use logout to end your own session");
}

    return this.withAudit(
      AuditAction.USER_SESSION_REVOKED,
      req,
      meta,
      { userId: id },
      async () => {
        const deleted = await this.sessionService.revokeUser(id);
        return {
          revoked: deleted > 0,
          message:
            deleted > 0
              ? "User has been logged out"
              : "User had no active session",
        };
      },
      {
        // snapshot of what is being terminated (no token hash, ever)
        before: async () => {
          const { items } = await this.sessionService.listActiveSessions({
            userId: id,
            limit: 1,
          });
          const s = items[0];
          return s
            ? {
                sessionId: s.sessionId,
                createdAt: s.createdAt,
                lastActivityAt: s.lastActivityAt,
                browser: s.browser,
                os: s.os,
                device: s.device,
                ipAddress: s.ipAddress,
              }
            : { session: null };
        },
        after: async () => ({ session: null }),
      },
    );
  }

  @Get("users/:id/session")
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getUserSession(@Param("id") id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException("Invalid user id");
    }
    
    const s = (await this.sessionService.getActiveSessionMap([id])).get(id);
    return {
      isActive: !!s,
      lastActivityAt: s?.lastActivityAt ?? null,
      browser: s?.browser ?? null,
      os: s?.os ?? null,
      device: s?.device ?? null,
    };
  }
}
