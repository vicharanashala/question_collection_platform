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
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AdminService } from './admin.service';
import {
  ListUsersDto,
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
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { CacheInvalidate } from '../cache/decorators/cache-invalidate.decorator';
import { Cacheable } from '../cache/decorators/cacheable.decorator';

interface AuthenticatedRequest extends Request {
  user: { id: string; mobileNumber: string; role: string };
}

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR, UserRole.FINANCE)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ─────────────────────────────────────────────────────────────
  // Section 1: User Management — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Post("users")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.CREATED)
  @CacheInvalidate('analytics:*', 'hot:*')
  async createUser(
    @Body() dto: CreateUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.createUser(
      req.user.id,
      req.user.role as UserRole,
      dto,
    );
  }

  @Get("users")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable('admin_users', 60)
  async listUsers(@Query() dto: ListUsersDto) {
    return this.adminService.listUsers(dto);
  }

  @Get("users/:id")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable((args) => `admin_user:${args[0]}`, 120)
  async getUserDetail(@Param("id") id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Post("users/:id/suspend")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('user:*')
  async suspendUser(
    @Param("id") id: string,
    @Body() body: SuspendUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.suspendOrBanUser(
      req.user.id,
      id,
      body.action,
      body.reason,
      body.suspendedUntil,
    );
  }

  @Post("users/:id/unsuspend")
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('user:*')
  async unsuspendUser(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.unsuspendOrUnbanUser(req.user.id, id);
  }

  @Post("users/:id/verify")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('user:*')
  async verifyUser(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    return this.adminService.verifyUser(req.user.id, id);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 2: Question Review — curator read-only (queue + metrics only)
  // ─────────────────────────────────────────────────────────────

  @Get("questions/queue")
  @HttpCode(HttpStatus.OK)
  @Cacheable('review_queue', 60)
  async listReviewQueue(@Query() dto: ListReviewQueueDto) {
    return this.adminService.listReviewQueue(dto);
  }

  /** Question quality and volume metrics — curator read-only */
  @Get("questions/metrics")
  @HttpCode(HttpStatus.OK)
  @Cacheable('question_metrics', 120)
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

  @Post("questions/:id/review")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.CURATOR)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('leaderboard:top_users', 'hot:*', 'analytics:*')
  async reviewQuestion(
    @Param("id") id: string,
    @Body() dto: ReviewActionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const role = req.user.role as UserRole;
    return this.adminService.reviewQuestion(req.user.id, id, dto, role);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 3: Configuration — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Get("config")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable('config', 300)
  async listConfig() {
    return this.adminService.listConfig();
  }

  @Post("config")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.CREATED)
  @CacheInvalidate('meta:*')
  async createConfig(
    @Body() dto: CreateConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.createConfig(req.user.id, dto);
  }

  @Patch("config")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('meta:*', 'hot:reward_tiers')
  async updateConfig(
    @Body() dto: UpdateConfigDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.updateConfig(req.user.id, dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 4: Analytics Dashboard — curator uses dedicated question-metrics endpoint
  // ─────────────────────────────────────────────────────────────

  @Get("analytics/dashboard")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable('dashboard', 60)
  async getDashboard(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getDashboardStats(dto);
  }

  /** Full stats for the admin dashboard */
  @Get("stats")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Cacheable('admin_stats', 60)
  async getStats(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getStats(dto);
  }

  @Get("analytics/rewards")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable('reward_summary', 120)
  async getRewardSummary(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getRewardSummary(dto);
  }

  @Get("analytics/reward-logs")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable('reward_logs', 60)
  async getRewardLogs(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.listRewardLogs(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 5: Fraud — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Get("fraud")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable('fraud_stats', 60)
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
  @Cacheable('admin_wallets', 60)
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
  @CacheInvalidate('wallet:*')
  async adjustWalletBalance(
    @Body() dto: AdjustWalletDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.adjustWalletBalance(req.user.id, dto);
  }

  /** Financial summary stats for the finance role dashboard */
  @Get("analytics/financial-summary")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable('financial_summary', 60)
  async getFinancialSummary(@Query() dto: AnalyticsQueryDto) {
    return this.adminService.getFinancialSummary(dto);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 6b: Withdrawals — curator blocked
  // ─────────────────────────────────────────────────────────────

  @Get("withdrawals")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @Cacheable('withdrawals_list', 60)
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
  @CacheInvalidate('wallet:*')
  async processWithdrawal(
    @Param("id") id: string,
    @Body() dto: ProcessWithdrawalDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.processWithdrawal(
      req.user.id,
      id,
      dto,
      req.user.role as UserRole,
    );
  }

  /** Retry a failed PineLabs payout for a PROCESSING withdrawal */
  @Post("withdrawals/:id/retry")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('wallet:*')
  async retryWithdrawal(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.retryWithdrawal(req.user.id, id);
  }

  /**
   * Retry a failed withdrawal that was already refunded.
   * Resets the withdrawal to PROCESSING, creates a new DEBIT transaction,
   * re-attempts the PineLabs payout, and re-refunds if it fails again.
   */
  @Post("withdrawals/:id/retry-refund")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('wallet:*')
  async retryFailedWithdrawal(
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.retryFailedWithdrawal(req.user.id, id);
  }

  /** Admin explicitly marks a PROCESSING withdrawal as FAILED and refunds the user */
  @Post("withdrawals/:id/fail")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('wallet:*')
  async markWithdrawalFailed(
    @Param("id") id: string,
    @Body() dto: MarkWithdrawalFailedDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.markWithdrawalFailed(req.user.id, id, dto.reason);
  }

  /** Admin updates the failure reason on an already-failed withdrawal */
  @Patch("withdrawals/:id/failure-reason")
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE)
  @HttpCode(HttpStatus.OK)
  @CacheInvalidate('wallet:*')
  async updateWithdrawalFailureReason(
    @Param("id") id: string,
    @Body() dto: UpdateWithdrawalFailureReasonDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.adminService.updateWithdrawalFailureReason(
      req.user.id,
      id,
      dto.reason,
    );
  }

  /** Super admin only: flush cache keys matching a pattern. */
  @Post('cache/flush')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async flushCache(
    @Body() body: { keyPattern: string },
    @Req() req: AuthenticatedRequest,
  ) {
    if (!body.keyPattern || !body.keyPattern.trim()) {
      throw new BadRequestException('keyPattern is required');
    }
    return this.adminService.flushCache(body.keyPattern.trim());
  }
}