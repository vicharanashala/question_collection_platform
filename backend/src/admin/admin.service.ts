import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ILike, Between, In, DataSource } from 'typeorm';
import { RedisService } from '../cache/redis.service';
import { HotDataService } from '../cache/hot-data.service';
import { AnalyticsCacheService } from '../cache/analytics-cache.service';
import {
  User,
  Question,
  Wallet,
  Transaction,
  WithdrawalRequest,
  AuditLog,
  AdminConfig,
  Notification,
  NotificationType,
  NotificationTriggerType,
  PaymentLog,
  UserPaymentDetail,
} from '../database/entities';
import {
  VerificationStatus,
  QuestionStatus,
  UserRole,
  UserCategory,
  AuditAction,
  ActorType,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  WithdrawalStatus,
  PaymentLogStatus,
} from '../common/enums';
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
  FraudQueryDto,
  ListUserTransactionsDto,
  ListUserWithdrawalsDto,
  AdjustWalletDto,
  ListAllWalletsDto,
} from './dto';
import { ConfigService } from '@nestjs/config';
import { WalletsService } from '../wallets/wallets.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PinelabsService } from '../payment/pinelabs.service';
import { RazorpayPayoutService } from '../payment/razorpay-payout.service';
import { decrypt } from '../common/utils/encryption.util';

// Config key constants — mirrors database.md defaults
const DEFAULT_CONFIG: Record<string, { value: number; description: string }> = {
  max_users_per_state: { value: 100, description: 'Maximum registered users per state' },
  min_withdrawal_amount: { value: 50, description: 'Minimum withdrawal threshold (INR)' },
  question_edit_window_seconds: { value: 30, description: 'Edit window after submission (seconds)' },
  daily_question_limit: { value: 20, description: 'Max questions per user per day' },
  duplicate_similarity_threshold: { value: 0.9, description: 'Semantic similarity threshold for duplicate detection' },
  video_max_duration_seconds: { value: 10, description: 'Maximum video duration (seconds)' },
  video_max_size_mb: { value: 10, description: 'Maximum video file size (MB)' },
  max_question_chars: { value: 1000, description: 'Maximum characters allowed in a question' },
  max_image_size_mb: { value: 5, description: 'Maximum image file size per question (MB)' },
};

@Injectable()
export class AdminService implements OnModuleInit {
  // In-memory TTL cache for config values (30-second cache)
  private configCache: Map<string, number> = new Map();
  private configCacheExpiry = 0;
  private static readonly CONFIG_CACHE_TTL_MS = 30_000;

  async onModuleInit() {
    // Pre-populate cache on startup so first requests aren't cache-miss latency
    await this.refreshConfigCache();
  }

  private async refreshConfigCache(): Promise<void> {
    const rows = await this.configRepo.find();
    this.configCache.clear();
    for (const row of rows) {
      this.configCache.set(row.key, row.value as number);
    }
    this.configCacheExpiry = Date.now() + AdminService.CONFIG_CACHE_TTL_MS;
  }

  private async getCachedConfigValue(key: string): Promise<number> {
    if (Date.now() > this.configCacheExpiry) {
      await this.refreshConfigCache();
    }
    if (this.configCache.has(key)) {
      return this.configCache.get(key)!;
    }
    // Fallback to DB for keys that may not be seeded
    const row = await this.configRepo.findOne({ where: { key } });
    const value = row ? (row.value as number) : (DEFAULT_CONFIG[key]?.value ?? 0);
    this.configCache.set(key, value);
    return value;
  }

  /**
   * Bulk-fetch multiple config values in a single DB call (uses cache).
   * Returns a plain object of key → value for the requested keys.
   */
  async getConfigValues(keys: string[]): Promise<Record<string, number>> {
    if (Date.now() > this.configCacheExpiry) {
      await this.refreshConfigCache();
    }
    const result: Record<string, number> = {};
    const missing: string[] = [];
    for (const key of keys) {
      if (this.configCache.has(key)) {
        result[key] = this.configCache.get(key)!;
      } else {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      const rows = await this.configRepo.find({ where: missing.map((k) => ({ key: k })) });
      for (const row of rows) {
        this.configCache.set(row.key, row.value as number);
        result[row.key] = row.value as number;
      }
      // Fill missing with defaults
      for (const k of missing) {
        if (result[k] === undefined) {
          const def = DEFAULT_CONFIG[k]?.value ?? 0;
          this.configCache.set(k, def);
          result[k] = def;
        }
      }
    }
    return result;
  }
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(AdminConfig)
    private readonly configRepo: Repository<AdminConfig>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(PaymentLog)
    private readonly paymentLogRepo: Repository<PaymentLog>,
    @InjectRepository(UserPaymentDetail)
    private readonly paymentDetailRepo: Repository<UserPaymentDetail>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WalletsService))
    private readonly walletsService: WalletsService,
    private readonly notificationsService: NotificationsService,
    private readonly pinelabsService: PinelabsService,
    private readonly razorpayPayoutService: RazorpayPayoutService,
    private readonly redisService: RedisService,
    private readonly hotDataService: HotDataService,
    private readonly analyticsCacheService: AnalyticsCacheService,
  ) {}

  private readonly logger = new Logger(AdminService.name);

  /** Maps an audit action + entity to a human-readable description string. */
  private buildActivityDescription(
    action: string,
    entityType: string | null,
    metadata: Record<string, unknown> | null,
  ): string {
    switch (action) {
      case AuditAction.QUESTION_SUBMITTED:
        return `Submitted a question${metadata?.cropType ? ` about ${metadata.cropType}` : ''}`;
      case AuditAction.QUESTION_APPROVED:
        return `Approved ${entityType ?? 'question'}`;
      case AuditAction.QUESTION_REJECTED:
        return `Rejected ${entityType ?? 'question'}`;
      case AuditAction.USER_REGISTERED:
        return 'Registered on the platform';
      case AuditAction.USER_VERIFIED:
        return `Verified user`;
      case AuditAction.USER_SUSPENDED:
        return `Suspended user`;
      case AuditAction.USER_BANNED:
        return `Banned user`;
      case AuditAction.USER_UNSUSPENDED:
        return `Unsuspended user`;
      case AuditAction.USER_UNBANNED:
        return `Unbanned user`;
      case AuditAction.USER_PROFILE_UPDATED:
        return `Updated user profile`;
      case AuditAction.REWARD_CREDITED:
        return `Credited reward${metadata?.amount ? ` of ₹${metadata.amount}` : ''}`;
      case AuditAction.WITHDRAWAL_REQUESTED:
        return `Requested withdrawal${metadata?.amount ? ` of ₹${metadata.amount}` : ''}`;
      case AuditAction.WITHDRAWAL_COMPLETED:
        return `Completed withdrawal${metadata?.amount ? ` of ₹${metadata.amount}` : ''}`;
      case AuditAction.ADMIN_CONFIG_UPDATED:
        return `Updated config: ${metadata?.key ?? action}`;
      default:
        return action.replace(/_/g, ' ');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Section 1: User Management
  // ─────────────────────────────────────────────────────────────

  async createUser(
    actorId: string,
    actorRole: UserRole,
    dto: {
      name: string;
      mobileNumber: string;
      role: UserRole;
      category?: string;
      state: string;
      district: string;
      block: string;
      village: string;
      kvk?: string;
      languagePreference?: string;
      courseName?: string;
      collegeName?: string;
      universityName?: string;
      organisationType?: string;
      organisationName?: string;
      memberRole?: string;
    },
  ) {
    // Super admin cannot create another super admin
    if (actorRole === UserRole.SUPER_ADMIN && dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin cannot assign a super admin role.');
    }

    // Cannot create a super admin through this endpoint (only ADMIN can create one)
    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Super admin role cannot be assigned via this endpoint.');
    }

    // Normalize: strip +91 or 0 prefix so numbers are stored consistently
    const mobile = dto.mobileNumber.replace(/^\+91 ?/, '').replace(/^0/, '');

    // Check for duplicate mobile number
    const existing = await this.userRepo.findOne({ where: { mobileNumber: mobile } });
    if (existing) {
      throw new BadRequestException('A user with this mobile number already exists.');
    }

    // Enforce max_users_per_state (only for non-privileged roles)
    if (dto.role !== UserRole.ADMIN && dto.role !== UserRole.CURATOR) {
      const maxPerState = await this.getConfigValue('max_users_per_state');
      const stateCount = await this.userRepo.count({
        where: { state: dto.state },
      });
      if (stateCount >= maxPerState) {
        throw new BadRequestException(
          `State '${dto.state}' has reached its maximum of ${maxPerState} users.`,
        );
      }
    }

    const isPrivilegedRole = dto.role === UserRole.ADMIN || dto.role === UserRole.CURATOR;

    const user = this.userRepo.create({
      name: dto.name.trim(),
      mobileNumber: mobile,
      role: dto.role,
      // Admins/curators don't have a category
      category: (isPrivilegedRole ? null : dto.category) as UserCategory | null,
      state: dto.state,
      district: dto.district,
      block: dto.block ?? null,
      village: dto.village ?? null,
      kvk: dto.kvk ?? null,
      languagePreference: dto.languagePreference ?? 'en',
      organisationType: dto.organisationType ?? null,
      courseName:      dto.courseName ?? null,
      collegeName:     dto.collegeName ?? null,
      universityName:  dto.universityName ?? null,
      organizationName:   dto.organisationName ?? null,
      organizationRole:   dto.memberRole ?? null,
      verificationStatus: VerificationStatus.VERIFIED,
      tokenVersion: 0,
      lastLoginAt: null,
    });

    await this.userRepo.save(user);

    await this.logAudit({
      actorType: actorRole === UserRole.CURATOR ? ActorType.CURATOR : ActorType.ADMIN,
      actorId,
      action: AuditAction.USER_REGISTERED,
      entityType: 'user',
      entityId: user.id,
      newValue: {
        name: user.name,
        mobileNumber: user.mobileNumber,
        role: user.role,
        category: user.category,
        state: user.state,
        district: user.district,
      },
    });

    return { user: this.toPublicUser(user) };
  }

  async listUsers(dto: ListUsersDto) {
    const { page = 1, limit = 20, state, category, status, search, sortBy = 'createdAt', sortOrder = 'DESC' } = dto;
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select([
        'u.id',
        'u.mobileNumber',
        'u.name',
        'u.category',
        'u.state',
        'u.district',
        'u.verificationStatus',
        'u.role',
        'u.createdAt',
        'u.lastLoginAt',
      ])
      .skip((page - 1) * limit)
      .take(limit);

    if (state) qb.andWhere('u.state = :state', { state });
    if (category) qb.andWhere('u.category = :category', { category });
    if (status) qb.andWhere('u.verificationStatus = :status', { status });
    if (search) {
      qb.andWhere(
        `(u.name ILIKE :search OR u.mobileNumber ILIKE :search)`,
        { search: `%${search}%` },
      );
    }
    if (dto.excludeId) qb.andWhere('u.id != :excludeId', { excludeId: dto.excludeId });

    const sortCol = sortBy === 'verificationStatus' ? 'u.verificationStatus' : sortBy === 'state' ? 'u.state' : sortBy === 'name' ? 'u.name' : 'u.createdAt';
    qb.orderBy(sortCol, sortOrder);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['wallet'],
      select: [
        'id', 'mobileNumber', 'name', 'role', 'verificationStatus',
        'category', 'district', 'state', 'block', 'village', 'kvk', 'numberOfFarmers',
        'organisationType',
        'languagePreference',
        'age', 'gender', 'farmSize', 'season', 'cropType',
        'courseName', 'collegeName', 'universityName',
        'organizationName', 'organizationRole', 'organizationState', 'organizationDistrict', 'organizationBlock', 'organizationVillage',
        'crops',
        'createdAt', 'lastLoginAt',
        'suspendedAt', 'suspendedUntil', 'suspendedReason',
        'bannedAt', 'bannedReason',
        'consentGiven', 'consentTimestamp',
      ],
    });
    if (!user) throw new NotFoundException('User not found');

    const questions = await this.questionRepo.find({
      where: { userId },
      order: { submittedAt: 'DESC' },
      take: 20,
      select: [
        'id',
        'questionText',
        'status',
        'submittedAt',
        'reviewedAt',
        'rejectionReason',
      ],
    });

    const paymentDetails = await this.paymentDetailRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return { user, questions, paymentDetails, crops: user.crops ?? [] };
  }

  async suspendOrBanUser(
    adminId: string,
    userId: string,
    action: 'suspend' | 'ban',
    reason?: string,
    suspendedUntil?: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isSuperAdmin = await this.isSuperAdmin(adminId);
    if (!isSuperAdmin) throw new ForbiddenException('Only super admins can suspend or ban users');

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot suspend or ban a super admin');
    }

    const newStatus = action === 'ban' ? VerificationStatus.BANNED : VerificationStatus.SUSPENDED;
    const oldStatus = user.verificationStatus;
    const now = new Date();

    await this.userRepo.update(userId, {
      verificationStatus: newStatus,
      ...(action === 'ban'
        ? {
            bannedAt: now,
            bannedReason: reason ?? null,
            suspendedAt: null,
            suspendedReason: null,
            suspendedUntil: null,
          }
        : {
            suspendedAt: now,
            suspendedUntil: suspendedUntil ? new Date(suspendedUntil) : null,
            suspendedReason: reason ?? null,
            bannedAt: null,
            bannedReason: null,
          }),
    });

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: action === 'ban' ? AuditAction.USER_BANNED : AuditAction.USER_SUSPENDED,
      entityType: 'user',
      entityId: userId,
      oldValue: { verificationStatus: oldStatus },
      newValue: { verificationStatus: newStatus, reason, suspendedUntil: suspendedUntil ?? null },
    });

    return { success: true, userId, newStatus };
  }

  async unsuspendOrUnbanUser(adminId: string, userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isSuperAdmin = await this.isSuperAdmin(adminId);
    if (!isSuperAdmin) throw new ForbiddenException('Only super admins can unsuspend or unban users');

    if (
      user.verificationStatus !== VerificationStatus.SUSPENDED &&
      user.verificationStatus !== VerificationStatus.BANNED
    ) {
      throw new BadRequestException('User is not suspended or banned');
    }

    const oldStatus = user.verificationStatus;
    await this.userRepo.update(userId, {
      verificationStatus: VerificationStatus.VERIFIED,
      suspendedAt: null,
      suspendedUntil: null,
      suspendedReason: null,
      bannedAt: null,
      bannedReason: null,
    });

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: oldStatus === VerificationStatus.BANNED ? AuditAction.USER_UNBANNED : AuditAction.USER_UNSUSPENDED,
      entityType: 'user',
      entityId: userId,
      oldValue: { verificationStatus: oldStatus },
      newValue: { verificationStatus: VerificationStatus.VERIFIED },
    });

    return { success: true, userId, newStatus: VerificationStatus.VERIFIED };
  }

  async verifyUser(actorId: string, userId: string) {
    const actor = await this.userRepo.findOne({ where: { id: actorId } });
    if (!actor) throw new NotFoundException('Actor not found');
    const validActors = [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.FINANCE];
    if (!validActors.includes(actor.role as UserRole)) {
      throw new ForbiddenException('Only admins, super admins or finance can verify users');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const oldStatus = user.verificationStatus;
    if (oldStatus === VerificationStatus.VERIFIED) {
      return { success: true, userId, newStatus: oldStatus, message: 'User already verified' };
    }

    await this.userRepo.update(userId, { verificationStatus: VerificationStatus.VERIFIED });

    await this.logAudit({
      actorType: actor.role === UserRole.FINANCE ? ActorType.FINANCE : ActorType.ADMIN,
      actorId: actorId,
      action: AuditAction.USER_VERIFIED,
      entityType: 'user',
      entityId: userId,
      oldValue: { verificationStatus: oldStatus },
      newValue: { verificationStatus: VerificationStatus.VERIFIED },
    });

    return { success: true, userId, newStatus: VerificationStatus.VERIFIED };
  }

  // ─────────────────────────────────────────────────────────────
  // Section 2: Question Review
  // ─────────────────────────────────────────────────────────────

  async listReviewQueue(dto: ListReviewQueueDto) {
    const {
      page = 1, limit = 20, queueType, state, search,
      status, sortBy = 'submittedAt', sortOrder = 'DESC',
      fromDate, toDate,
    } = dto;

    const qb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.user', 'u')
      .leftJoinAndSelect('q.reviewer', 'r')
      .select([
        'q.id',
        'q.userId',
        'q.questionText',
        'q.mediaType',
        'q.mediaUrls',
        'q.status',
        'q.submittedAt',
        'q.reviewedAt',
        'q.rejectionReason',
        'q.heldReason',
        'q.approvalReason',
        'q.language',
        'q.domains',
        'q.cropType',
        'q.state',
        'q.district',
        'u.name',
        'u.mobileNumber',
        'r.name',
      ])
      .skip((page - 1) * limit)
      .take(limit);

    // Status filter
    if (status && status.length > 0) {
      if (status.length === 1) {
        qb.andWhere('q.status = :status', { status: status[0] });
      } else {
        qb.andWhere('q.status IN (:...statuses)', { statuses: status });
      }
    } else {
      // Default: show all reviewable statuses (pending + queues)
      const defaultStatuses = queueType === 'ai_review'
        ? [QuestionStatus.AI_REVIEW]
        : [QuestionStatus.PENDING, QuestionStatus.HUMAN_REVIEW, QuestionStatus.AI_REVIEW];
      qb.andWhere('q.status IN (:...statuses)', { statuses: defaultStatuses });
    }

    // State filter
    if (state) qb.andWhere('q.state = :state', { state });

    // Search: question text or user mobile
    if (search) {
      qb.andWhere(
        `(q.questionText ILIKE :search OR u.mobileNumber ILIKE :search)`,
        { search: `%${search}%` },
      );
    }

    // Date range
    if (fromDate) qb.andWhere('q.submittedAt >= :fromDate', { fromDate: new Date(fromDate) });
    if (toDate) qb.andWhere('q.submittedAt <= :toDate', { toDate: new Date(toDate) });

    // Sorting
    const sortColumn =
      sortBy === 'state' ? 'q.state'
      : sortBy === 'reviewedAt' ? 'q.reviewedAt'
      : 'q.submittedAt';
    qb.orderBy(sortColumn, sortOrder);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((q) => ({
        ...q,
        user: q.user ? { id: q.user.id, name: q.user.name, mobileNumber: q.user.mobileNumber } : null,
        reviewedByName: (q as any).reviewer?.name ?? null,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getQuestionForReview(questionId: string) {
    const question = await this.questionRepo.findOne({
      where: { id: questionId },
      relations: ['user', 'reviewer'],
    });
    if (!question) throw new NotFoundException('Question not found');
    return {
      ...question,
      user: question.user
        ? { id: question.user.id, name: question.user.name, mobileNumber: question.user.mobileNumber, state: question.user.state }
        : null,
      reviewedByName: question.reviewer?.name ?? null,
    };
  }

  async reviewQuestion(
    reviewerId: string,
    questionId: string,
    dto: ReviewActionDto,
    reviewerRole: UserRole = UserRole.ADMIN,
  ) {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');

    const terminalStatuses = [QuestionStatus.APPROVED, QuestionStatus.REJECTED];
    if (terminalStatuses.includes(question.status)) {
      throw new BadRequestException('Question has already been reviewed');
    }

    const actorType: ActorType =
      reviewerRole === UserRole.CURATOR ? ActorType.CURATOR : ActorType.ADMIN;
    const oldStatus = question.status;

    if (dto.action === 'approve') {
      // Count total approved questions for this user (to compute reward tier)
      const approvedCount = await this.questionRepo.count({
        where: { userId: question.userId, status: QuestionStatus.APPROVED },
      });
      // Include the one being approved right now in the count for tier calculation
      const rewardTierCount = approvedCount + 1;

      await this.questionRepo.update(questionId, {
        status: QuestionStatus.APPROVED,
        reviewerId: reviewerId,
        reviewedAt: new Date(),
        approvalReason: dto.reason ?? null,
      });

      // Credit reward to user wallet
      const rewardResult = await this.walletsService.creditReward({
        userId: question.userId,
        questionId,
        approvedCount: rewardTierCount,
      });

      // Update Redis caches: leaderboard score + analytics counters
      await Promise.all([
        this.hotDataService.incrementLeaderboardScore(Number(question.userId), 1),
        this.analyticsCacheService.onQuestionApproved(),
        this.hotDataService.incrementTodayApprovals(),
      ]).catch((err) => this.logger.warn(`Redis cache update failed after approval: ${err.message}`));

      await this.logAudit({
        actorType,
        actorId: reviewerId,
        action: AuditAction.QUESTION_APPROVED,
        entityType: 'question',
        entityId: questionId,
        oldValue: { status: oldStatus },
        newValue: { status: QuestionStatus.APPROVED, reward: rewardResult.transaction.amount },
      });

      await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: question.userId,
          type: NotificationType.QUESTION_APPROVED,
          title: 'Question Approved',
          body: `Your question "${question.questionText.slice(0, 80)}..." has been approved. Rs. ${rewardResult.transaction.amount} has been credited to your wallet.`,
          data: { questionId, status: 'approved' },
          triggerType: NotificationTriggerType.QUESTION,
        }),
      );

      return {
        success: true,
        action: 'approved',
        questionId,
        rewardCredited: rewardResult.transaction.amount,
        newBalance: rewardResult.newBalance,
      };
    }

    if (dto.action === 'reject') {
      // Reason is required for rejection
      if (!dto.reason || !dto.reason.trim()) {
        throw new BadRequestException('Rejection reason is required when rejecting a question');
      }
      await this.questionRepo.update(questionId, {
        status: QuestionStatus.REJECTED,
        reviewerId: reviewerId,
        reviewedAt: new Date(),
        rejectionReason: dto.reason ?? null,
      });
      await this.analyticsCacheService.onQuestionRejected().catch(
        (err) => this.logger.warn(`Redis cache update failed after rejection: ${err.message}`),
      );
      await this.logAudit({
        actorType,
        actorId: reviewerId,
        action: AuditAction.QUESTION_REJECTED,
        entityType: 'question',
        entityId: questionId,
        oldValue: { status: oldStatus },
        newValue: { status: QuestionStatus.REJECTED, reason: dto.reason },
      });
      await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: question.userId,
          type: NotificationType.QUESTION_REJECTED,
          title: 'Question Not Approved',
          body: `Your question "${question.questionText.slice(0, 80)}..." was not approved. Reason: ${dto.reason}`,
          data: { questionId, status: 'rejected' },
          triggerType: NotificationTriggerType.QUESTION,
        }),
      );
      return { success: true, action: 'rejected', questionId, rejectionReason: dto.reason };
    }

    if (dto.action === 'hold') {
      // Held reason is required when putting a question on hold
      if (!dto.heldReason || !dto.heldReason.trim()) {
        throw new BadRequestException('Held reason is required when holding a question');
      }
      // Held status: question is put on hold for later re-review
      await this.questionRepo.update(questionId, {
        status: QuestionStatus.HELD,
        reviewerId: reviewerId,
        reviewedAt: new Date(),
        heldReason: dto.heldReason ?? null,
      });
      await this.logAudit({
        actorType,
        actorId: reviewerId,
        action: 'question_held',
        entityType: 'question',
        entityId: questionId,
        oldValue: { status: oldStatus },
        newValue: { status: QuestionStatus.HELD, reason: dto.heldReason },
      });
      await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: question.userId,
          type: NotificationType.QUESTION_HELD,
          title: 'Question Under Review',
          body: `Your question "${question.questionText.slice(0, 80)}..." has been placed under review. Reason: ${dto.heldReason}`,
          data: { questionId, status: 'held' },
          triggerType: NotificationTriggerType.QUESTION,
        }),
      );
      return { success: true, action: 'held', questionId, heldReason: dto.heldReason };
    }

    // request_info — move to human_review for more info from user
    await this.questionRepo.update(questionId, {
      status: QuestionStatus.HUMAN_REVIEW,
    });
    await this.logAudit({
      actorType,
      actorId: reviewerId,
      action: 'question_review_request_info',
      entityType: 'question',
      entityId: questionId,
      oldValue: { status: oldStatus },
      newValue: { status: QuestionStatus.HUMAN_REVIEW },
    });
    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: question.userId,
        type: NotificationType.QUESTION_INFO_REQUESTED,
        title: 'More Information Needed',
        body: `Your question "${question.questionText.slice(0, 80)}..." requires additional information.`,
        data: { questionId, status: 'human_review' },
          triggerType: NotificationTriggerType.QUESTION,
      }),
    );
    return { success: true, action: 'request_info', questionId };
  }

  // ─────────────────────────────────────────────────────────────
  // Section 3: Configuration Management
  // ─────────────────────────────────────────────────────────────

  async listConfig() {
    // Seed defaults that don't exist yet
    for (const [key, cfg] of Object.entries(DEFAULT_CONFIG)) {
      const existing = await this.configRepo.findOne({ where: { key } });
      if (!existing) {
        await this.configRepo.save({
          key,
          value: cfg.value,
          description: cfg.description,
        });
      }
    }

    const configs = await this.configRepo.find({ order: { key: 'ASC' } });
    return { items: configs.map((c) => ({ key: c.key, value: c.value, description: c.description })) };
  }

  async updateConfig(adminId: string, dto: UpdateConfigDto) {
    const config = await this.configRepo.findOne({ where: { key: dto.key } });
    if (!config) throw new NotFoundException(`Config key '${dto.key}' not found`);

    const oldValue = config.value;

    await this.configRepo.update({ key: dto.key }, {
      value: dto.value,
      description: dto.description ?? config.description,
      updatedBy: adminId,
    });

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: AuditAction.ADMIN_CONFIG_UPDATED,
      entityType: 'admin_config',
      entityId: config.id,
      oldValue: { key: dto.key, value: oldValue },
      newValue: { key: dto.key, value: dto.value },
    });

    // Invalidate cache so next read gets the new value
    this.configCache.delete(dto.key);

    return { success: true, key: dto.key, oldValue, newValue: dto.value };
  }

  async createConfig(adminId: string, dto: CreateConfigDto) {
    const existing = await this.configRepo.findOne({ where: { key: dto.key } });
    if (existing) throw new BadRequestException(`Config key '${dto.key}' already exists`);

    const saved = await this.configRepo.save({
      key: dto.key,
      value: dto.value,
      description: dto.description,
      updatedBy: adminId,
    });

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: AuditAction.ADMIN_CONFIG_UPDATED,
      entityType: 'admin_config',
      entityId: saved.id,
      newValue: { key: dto.key, value: dto.value },
    });

    // Populate cache for the new key
    this.configCache.set(dto.key, dto.value);

    return { success: true, config: { key: saved.key, value: saved.value, description: saved.description } };
  }

  // Get a single config value (with fallback to default) — uses in-memory cache
  async getConfigValue(key: string): Promise<number> {
    return this.getCachedConfigValue(key);
  }

  // ─────────────────────────────────────────────────────────────
  // Section 4: Analytics & Dashboard
  // ─────────────────────────────────────────────────────────────

  async getDashboardStats(query: AnalyticsQueryDto) {
    const { fromDate, toDate, state, cropType } = query;
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const whereClause: Record<string, unknown> = {
      submittedAt: Between(from, to),
    };
    if (state) whereClause['state'] = state;
    if (cropType) whereClause['cropType'] = cropType;

    const [
      totalQuestions,
      approvedQuestions,
      rejectedQuestions,
      pendingQuestions,
      totalUsers,
      flaggedQuestions,
    ] = await Promise.all([
      this.questionRepo.count({ where: { ...whereClause } }),
      this.questionRepo.count({ where: { ...whereClause, status: QuestionStatus.APPROVED } }),
      this.questionRepo.count({ where: { ...whereClause, status: QuestionStatus.REJECTED } }),
      this.questionRepo.count({ where: { ...whereClause, status: In([QuestionStatus.PENDING, QuestionStatus.AI_REVIEW, QuestionStatus.HUMAN_REVIEW]) } }),
      this.userRepo.count(),
      this.questionRepo.count({ where: { ...whereClause, duplicateFlag: true } }),
    ]);

    // State breakdown
    const stateBreakdownRaw: Array<{ state: string; count: number }> = await this.questionRepo
      .createQueryBuilder('q')
      .select('q.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .groupBy('q.state')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // Category breakdown
    const categoryBreakdownRaw: Array<{ category: string; count: number }> = await this.userRepo
      .createQueryBuilder('u')
      .select('u.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.category')
      .getRawMany();

    // Daily question volume (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyVolumeRaw: Array<{ date: string; total: string; approved: string }> = await this.questionRepo
      .createQueryBuilder('q')
      .select("TO_CHAR(q.submittedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`COUNT(CASE WHEN q.status = 'approved' THEN 1 END)`, 'approved')
      .where('q.submittedAt >= :sevenDaysAgo', { sevenDaysAgo })
      .groupBy("TO_CHAR(q.submittedAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    return {
      summary: {
        totalQuestions,
        approvedQuestions,
        rejectedQuestions,
        pendingQuestions,
        totalUsers,
        flaggedQuestions,
        approvalRate: totalQuestions > 0 ? Math.round((approvedQuestions / totalQuestions) * 100) : 0,
      },
      stateBreakdown: stateBreakdownRaw.map((r) => ({ state: r.state, count: Number(r.count) })),
      categoryBreakdown: categoryBreakdownRaw.map((r) => ({ category: r.category, count: Number(r.count) })),
      dailyVolume: dailyVolumeRaw.map((r) => ({ date: r.date, total: Number(r.total), approved: Number(r.approved) })),
    };
  }

  /**
   * Full stats payload matching web/src/types/AdminStats.
   * GET /admin/stats
   */
  async getStats(_query: AnalyticsQueryDto) {
    const [
      totalUsers,
      verifiedUsers,
      pendingUsers,
      suspendedUsers,
      bannedUsers,
      totalQuestions,
      approvedQuestions,
      rejectedQuestions,
      pendingQuestions,
      usersThisWeek,
      questionsThisWeek,
      roleDist,
      categoryDist,
      historical,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { verificationStatus: VerificationStatus.VERIFIED } }),
      this.userRepo.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
      this.userRepo.count({ where: { verificationStatus: VerificationStatus.SUSPENDED } }),
      this.userRepo.count({ where: { verificationStatus: VerificationStatus.BANNED } }),
      this.questionRepo.count(),
      this.questionRepo.count({ where: { status: QuestionStatus.APPROVED } }),
      this.questionRepo.count({ where: { status: QuestionStatus.REJECTED } }),
      this.questionRepo.count({
        where: { status: In([QuestionStatus.PENDING, QuestionStatus.AI_REVIEW, QuestionStatus.HUMAN_REVIEW]) },
      }),
      // Users registered in last 7 days
      this.userRepo.count({
        where: { createdAt: Between(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          new Date(),
        ) },
      }),
      // Questions submitted in last 7 days
      this.questionRepo.count({
        where: { submittedAt: Between(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          new Date(),
        ) },
      }),
      // Role distribution
      this.userRepo
        .createQueryBuilder('u')
        .select('u.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .groupBy('u.role')
        .getRawMany<{ role: string; count: string }>(),
      // Category distribution
      this.userRepo
        .createQueryBuilder('u')
        .select('u.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .groupBy('u.category')
        .getRawMany<{ category: string; count: string }>(),
      // 90-day daily history (users, questions, signups, approved, rejected)
      this.questionRepo
        .createQueryBuilder('q')
        .select("TO_CHAR(q.submittedAt, 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(DISTINCT q.userId)', 'users')
        .addSelect('COUNT(*)', 'questions')
        .addSelect(`COUNT(CASE WHEN q.status = 'approved' THEN 1 END)`, 'approved')
        .addSelect(`COUNT(CASE WHEN q.status = 'rejected' THEN 1 END)`, 'rejected')
        .where('q.submittedAt >= :ninety', { ninety: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) })
        .groupBy("TO_CHAR(q.submittedAt, 'YYYY-MM-DD')")
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; users: string; questions: string; approved: string; rejected: string }>(),
    ])

    // Recent audit logs (last 20, joined with user for actor name)
    const recentLogs: Array<AuditLog & { actorName?: string }> = await this.auditRepo
      .createQueryBuilder('al')
      .leftJoin('users', 'u', 'al.actor_id = u.id')
      .select([
        'al.id AS id',
        'al.action AS action',
        'al.entity_type AS "entityType"',
        'al.metadata AS metadata',
        'al.created_at AS "createdAt"',
        'u.name AS "actorName"',
      ])
      .orderBy('al.created_at', 'DESC')
      .take(20)
      .getRawMany();

    // Signups per day from user registrations
    const signupRaw = await this.userRepo
      .createQueryBuilder('u')
      .select("TO_CHAR(u.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'signups')
      .where('u.createdAt >= :ninety', { ninety: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) })
      .groupBy("TO_CHAR(u.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; signups: string }>()

    const signupMap = new Map(signupRaw.map((r) => [r.date, Number(r.signups)]))

    const historicalDays: Array<{
      date: string
      users: number
      questions: number
      signups: number
      approved: number
      rejected: number
    }> = historical.map((h) => ({
      date: h.date,
      users: Number(h.users),
      questions: Number(h.questions),
      signups: signupMap.get(h.date) ?? 0,
      approved: Number(h.approved),
      rejected: Number(h.rejected),
    }))

    return {
      dashboard: {
        totalUsers,
        verifiedUsers,
        pendingUsers,
        suspendedUsers,
        bannedUsers,
        totalQuestions,
        approvedQuestions,
        rejectedQuestions,
        pendingQuestions,
        questionsThisWeek,
        usersThisWeek,
      },
      recentActivity: recentLogs.map((log) => ({
        id: log.id,
        action: log.action,
        description: this.buildActivityDescription(log.action, log.entityType as string | null, log.metadata as Record<string, unknown> | null),
        performedBy: (log as any).actorName ?? 'System',
        performedAt: (log as any).createdAt ? new Date((log as any).createdAt).toISOString() : new Date().toISOString(),
      })),
      roleDistribution: roleDist.map((r) => ({ role: r.role as UserRole, count: Number(r.count) })),
      categoryDistribution: categoryDist
        .filter((c) => c.category != null)
        .map((c) => ({ category: c.category as UserCategory, count: Number(c.count) })),
      historical: historicalDays,
      avgReviewTurnaroundMinutes: null, // populated separately via getQuestionMetrics for admin dashboard
    }
  }

  async getFinancialSummary(query: AnalyticsQueryDto) {
    const since = new Date(Date.now() - (query.days ?? 30) * 24 * 60 * 60 * 1000);

    const [
      totalPaidOut,
      pendingWithdrawalCount,
      pendingWithdrawalAmount,
      completedWithdrawalCount,
      completedWithdrawalAmount,
      failedWithdrawalCount,
      totalWalletBalance,
      todayPayoutCount,
      todayPayoutAmount,
      dailyPayoutTrend,
    ] = await Promise.all([
      // Total amount ever completed
      this.withdrawalRepo
        .createQueryBuilder('w')
        .select('COALESCE(SUM(w.amount), 0)', 'total')
        .where('w.status = :status', { status: WithdrawalStatus.COMPLETED })
        .getRawOne<{ total: string }>(),
      // Pending withdrawal count
      this.withdrawalRepo.count({ where: { status: WithdrawalStatus.PENDING } }),
      // Pending withdrawal total amount
      this.withdrawalRepo
        .createQueryBuilder('w')
        .select('COALESCE(SUM(w.amount), 0)', 'total')
        .where('w.status = :status', { status: WithdrawalStatus.PENDING })
        .getRawOne<{ total: string }>(),
      // Completed withdrawal count
      this.withdrawalRepo.count({ where: { status: WithdrawalStatus.COMPLETED } }),
      // Completed withdrawal total amount
      this.withdrawalRepo
        .createQueryBuilder('w')
        .select('COALESCE(SUM(w.amount), 0)', 'total')
        .where('w.status = :status', { status: WithdrawalStatus.COMPLETED })
        .getRawOne<{ total: string }>(),
      // Failed withdrawal count
      this.withdrawalRepo.count({ where: { status: WithdrawalStatus.FAILED } }),
      // Total balance across all wallets
      this.walletRepo
        .createQueryBuilder('w')
        .select('COALESCE(SUM(w.balance), 0)', 'total')
        .getRawOne<{ total: string }>(),
      // Today's payout count
      this.withdrawalRepo.count({
        where: {
          status: WithdrawalStatus.COMPLETED,
          processedAt: Between(
            new Date(new Date().setHours(0, 0, 0, 0)),
            new Date(),
          ),
        },
      }),
      // Today's payout amount
      this.withdrawalRepo
        .createQueryBuilder('w')
        .select('COALESCE(SUM(w.amount), 0)', 'total')
        .where('w.status = :status', { status: WithdrawalStatus.COMPLETED })
        .andWhere('w.processedAt >= :today', { today: new Date(new Date().setHours(0, 0, 0, 0)) })
        .getRawOne<{ total: string }>(),
      // Daily payout trend (last N days)
      this.withdrawalRepo
        .createQueryBuilder('w')
        .select("TO_CHAR(w.processedAt, 'YYYY-MM-DD')", 'date')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(w.amount), 0)', 'amount')
        .where('w.status = :status', { status: WithdrawalStatus.COMPLETED })
        .andWhere('w.processedAt >= :since', { since })
        .groupBy("TO_CHAR(w.processedAt, 'YYYY-MM-DD')")
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; count: string; amount: string }>(),
    ]);

    return {
      totalPaidOut: Number(totalPaidOut?.total ?? 0),
      pendingWithdrawals: {
        count: pendingWithdrawalCount,
        amount: Number(pendingWithdrawalAmount?.total ?? 0),
      },
      completedWithdrawals: {
        count: completedWithdrawalCount,
        amount: Number(completedWithdrawalAmount?.total ?? 0),
      },
      failedWithdrawals: {
        count: failedWithdrawalCount,
      },
      totalWalletBalance: Number(totalWalletBalance?.total ?? 0),
      today: {
        payoutCount: todayPayoutCount,
        payoutAmount: Number(todayPayoutAmount?.total ?? 0),
      },
      dailyPayoutTrend: dailyPayoutTrend.map((d) => ({
        date: d.date,
        count: Number(d.count),
        amount: Number(d.amount),
      })),
    };
  }

  async getRewardSummary(query: AnalyticsQueryDto) {
    const { fromDate, toDate, state } = query;
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const txWhere: Record<string, unknown> = {
      source: TransactionSource.REWARD,
      status: 'completed',
      createdAt: Between(from, to),
    };
    if (state) {
      // Join through wallet -> user to filter by state
    }

    const rewardTxs = await this.transactionRepo
      .createQueryBuilder('tx')
      .innerJoin('tx.wallet', 'w')
      .innerJoinAndSelect('w.user', 'u')
      .select([
        'SUM(tx.amount) as total_rewarded',
        'COUNT(tx.id) as reward_count',
        'AVG(tx.amount) as avg_reward',
      ])
      .where('tx.source = :source', { source: TransactionSource.REWARD })
      .andWhere('tx.status = :status', { status: 'completed' })
      .andWhere('tx.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne();

    const withdrawalStats = await this.withdrawalRepo
      .createQueryBuilder('wr')
      .select([
        'SUM(wr.amount) as total_withdrawn',
        'COUNT(wr.id) as withdrawal_count',
        "COUNT(CASE WHEN wr.status = 'pending' THEN 1 END) as pending_count",
      ])
      .where('wr.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne();

    return {
      totalRewarded: Number(rewardTxs?.total_rewarded ?? 0),
      rewardCount: Number(rewardTxs?.reward_count ?? 0),
      avgReward: Number(rewardTxs?.avg_reward ?? 0),
      totalWithdrawn: Number(withdrawalStats?.total_withdrawn ?? 0),
      withdrawalCount: Number(withdrawalStats?.withdrawal_count ?? 0),
      pendingWithdrawals: Number(withdrawalStats?.pending_count ?? 0),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Section 5: Reward & Payout
  // ─────────────────────────────────────────────────────────────

  async listWithdrawals(dto: ListWithdrawalsDto) {
    const {
      page = 1, limit = 20, status, state, search,
      sortBy = 'createdAt', sortOrder = 'DESC',
      fromDate, toDate, filterStatus,
    } = dto;
    const qb = this.withdrawalRepo
      .createQueryBuilder('wr')
      .leftJoinAndSelect('wr.user', 'u')
      .leftJoin('Transaction', 'tx', 'tx.reference_id = CAST(wr.id AS varchar) AND tx.type = :debitType', { debitType: TransactionType.DEBIT })
      .select([
        'wr.id',
        'wr.amount',
        'wr.payoutMethod',
        'wr.payoutDetails',
        'wr.status',
        'wr.createdAt',
        'wr.processedAt',
        'wr.pinelabsTransactionId',
        'wr.orderId',
        'tx.rejectionReason',
        'u.id',
        'u.name',
        'u.mobileNumber',
        'u.state',
      ])
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('wr.status = :status', { status });
    if (state) qb.andWhere('u.state = :state', { state });

    if (search) {
      qb.andWhere(
        `(u.name ILIKE :search OR u.mobileNumber ILIKE :search)`,
        { search: `%${search}%` },
      );
    }

    if (filterStatus === 'failed_pending_tx') {
      qb.andWhere('wr.status = :status', { status: 'failed' });
      qb.andWhere(
        `(SELECT COUNT(*) FROM transactions tx2
          WHERE tx2.reference_id = CAST(wr.id AS varchar)
            AND tx2.type = :debitType
            AND tx2.status = :failedStatus) = 0`,
        { debitType: TransactionType.DEBIT, failedStatus: TransactionStatus.FAILED },
      );
    }

    if (fromDate) qb.andWhere('wr.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
    if (toDate) qb.andWhere('wr.createdAt <= :toDate', { toDate: new Date(toDate) });

    const sortColumn = sortBy === 'amount' ? 'wr.amount' : sortBy === 'processedAt' ? 'wr.processedAt' : 'wr.createdAt';
    qb.orderBy(sortColumn, sortOrder);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((wr: any) => ({
        id: wr.id,
        amount: wr.amount,
        payoutMethod: wr.payoutMethod,
        payoutDetails: wr.payoutDetails,
        status: wr.status,
        createdAt: wr.createdAt,
        processedAt: wr.processedAt,
        pinelabsTransactionId: wr.pinelabsTransactionId,
        orderId: wr.orderId,
        rejectionReason: wr.rejectionReason ?? null,
        user: wr.user ? { id: wr.user.id, name: wr.user.name, mobileNumber: wr.user.mobileNumber, state: wr.user.state } : null,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async processWithdrawal(adminId: string, withdrawalId: string, dto: ProcessWithdrawalDto, reviewerRole?: UserRole) {
    const withdrawal = await this.withdrawalRepo.findOne({
      where: { id: withdrawalId },
      relations: ['user', 'wallet'],
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal request not found');
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      // Idempotent: if already processed, return current state without error.
      return {
        success: true,
        action: withdrawal.status === WithdrawalStatus.PROCESSING ? 'approved' : 'rejected',
        withdrawalId,
        status: withdrawal.status,
      };
    }

    if (dto.action === 'approve') {
      // ── Step 1: Fetch user's verified payment detail ──────────────────────────
      const paymentDetail = await this.paymentDetailRepo.findOne({
        where: { userId: withdrawal.userId, status: 'verified' },
        order: { verifiedAt: 'DESC' },
      });
      if (!paymentDetail) {
        throw new BadRequestException('No verified payment detail found for this user.');
      }

      // ── Step 2: Create or reuse Razorpay fund account ─────────────────────────
      let fundAccountId = paymentDetail.razorpayFundAccountId;
      if (!fundAccountId) {
        const fundAccount = await this.razorpayPayoutService.createFundAccount({
          userId: withdrawal.userId,
          phone: withdrawal.user.mobileNumber,
          name: withdrawal.user.name ?? 'User',
          existingContactId: withdrawal.user.razorpayContactId ?? undefined,
          vpa: paymentDetail.upiId ?? undefined,
          bankAccount:
            paymentDetail.ifsc && paymentDetail.accountNumberEncrypted
              ? {
                  accountNumber: decrypt(paymentDetail.accountNumberEncrypted),
                  ifsc: paymentDetail.ifsc,
                  accountHolderName: paymentDetail.accountHolderName ?? '',
                }
              : undefined,
        });
        fundAccountId = fundAccount.fundAccountId;
        // Persist fund account and contact ID for future use
        await this.paymentDetailRepo.update(paymentDetail.id, {
          razorpayFundAccountId: fundAccountId,
        });
        if (!withdrawal.user.razorpayContactId) {
          await this.userRepo.update(withdrawal.userId, {
            razorpayContactId: fundAccount.contactId,
          });
        }
      }

      const referenceId = `wd_${withdrawalId}`;
      const amountPaise = Math.round(Number(withdrawal.amount) * 100);
      const payoutMode = withdrawal.payoutMethod === 'upi' ? 'UPI' : 'IMPS';

      let payoutResult: { payoutId: string; status: string; utrNumber?: string | null };
      try {
        payoutResult = await this.razorpayPayoutService.initiatePayout({
          fundAccountId,
          amount: amountPaise,
          referenceId,
          mode: payoutMode,
          narration: 'Withdrawal payout',
        });
      } catch (err) {
        // Payout initiation failed — mark FAILED and refund immediately
        this.logger.error(`[Razorpay] initiatePayout failed for withdrawal ${withdrawalId}: ${err.message}`);
        await this.handleWithdrawalFailure({
          withdrawal,
          orderId: referenceId,
          adminId,
          result: {
            pinelabsTransactionId: null,
            errorCode: 'RAZORPAY_INIT_ERROR',
            errorMessage: err.message,
            rawResponse: {},
          },
        });
        return {
          success: true,
          action: 'approved',
          withdrawalId,
          status: WithdrawalStatus.FAILED,
          paymentFailed: true,
          errorCode: 'RAZORPAY_INIT_ERROR',
          errorMessage: err.message,
        };
      }

      // ── Step 4: Update withdrawal based on Razorpay response ─────────────────
      const { payoutId, status: razorpayStatus } = payoutResult;
      const finalStatus =
        razorpayStatus === 'success' || razorpayStatus === 'processed'
          ? WithdrawalStatus.COMPLETED
          : razorpayStatus === 'failed' || razorpayStatus === 'rejected'
          ? WithdrawalStatus.FAILED
          : WithdrawalStatus.PROCESSING;

      await this.withdrawalRepo.update(withdrawalId, {
        status: finalStatus,
        processedAt: finalStatus === WithdrawalStatus.COMPLETED ? new Date() : null,
        razorpayPayoutId: payoutId,
        orderId: referenceId,
        utrNumber: payoutResult.utrNumber ?? null,
      });

      // ── Step 5: Log the payment attempt ─────────────────────────────────────
      const paymentLog = this.paymentLogRepo.create({
        withdrawalRequestId: withdrawalId,
        adminId,
        orderId: referenceId,
        razorpayPayoutId: payoutId,
        utrNumber: payoutResult.utrNumber ?? null,
        status:
          finalStatus === WithdrawalStatus.COMPLETED
            ? PaymentLogStatus.SUCCESS
            : finalStatus === WithdrawalStatus.FAILED
            ? PaymentLogStatus.FAILED
            : PaymentLogStatus.PENDING,
      });
      await this.paymentLogRepo.save(paymentLog);

      const actorType: ActorType =
        reviewerRole === UserRole.FINANCE
          ? ActorType.FINANCE
          : reviewerRole === UserRole.CURATOR
          ? ActorType.CURATOR
          : ActorType.ADMIN;

      await this.logAudit({
        actorType,
        actorId: adminId,
        action: finalStatus === WithdrawalStatus.COMPLETED ? 'withdrawal_completed' : 'withdrawal_approved',
        entityType: 'withdrawal_request',
        entityId: withdrawalId,
      });

      // ── Step 6: On FAILED, trigger refund ────────────────────────────────────
      if (finalStatus === WithdrawalStatus.FAILED) {
        await this.handleWithdrawalFailure({
          withdrawal,
          orderId: referenceId,
          adminId,
          result: {
            pinelabsTransactionId: null,
            errorCode: `RAZORPAY_${razorpayStatus.toUpperCase()}`,
            errorMessage: `Razorpay payout status: ${razorpayStatus}`,
            rawResponse: { payoutId, razorpayStatus },
          },
        });
      } else {
        // Send notification (PROCESSING or COMPLETED)
        await this.notificationRepo.save(
          this.notificationRepo.create({
            userId: withdrawal.userId,
            type: NotificationType.WITHDRAWAL_APPROVED,
            title: 'Withdrawal Approved',
            body:
              finalStatus === WithdrawalStatus.COMPLETED
                ? `Your withdrawal of Rs. ${withdrawal.amount} has been credited to your account.`
                : `Your withdrawal of Rs. ${withdrawal.amount} has been approved and will be processed shortly.`,
            data: { withdrawalId, status: finalStatus === WithdrawalStatus.COMPLETED ? 'completed' : 'processing', userId: withdrawal.userId },
            triggerType: NotificationTriggerType.WITHDRAW,
          }),
        );
      }

      return {
        success: true,
        action: 'approved',
        withdrawalId,
        status: finalStatus,
        razorpayPayoutId: payoutId,
        paymentFailed: finalStatus === WithdrawalStatus.FAILED,
      };
    } else {
      const rejectionReason = dto.rejectionReason ?? 'Rejected by admin';
      await this.walletRepo.increment({ id: withdrawal.walletId }, 'balance', Number(withdrawal.amount));
      const updatedWallet = await this.walletRepo.findOne({ where: { id: withdrawal.walletId } });
      const newBalance = updatedWallet ? Number(updatedWallet.balance) : 0;
      await this.withdrawalRepo.update(withdrawalId, {
        status: WithdrawalStatus.REJECTED,
        processedAt: new Date(),
      });
      await this.transactionRepo.update(
        { referenceId: withdrawalId, status: TransactionStatus.PENDING },
        { status: TransactionStatus.REJECTED, rejectionReason },
      );
      await this.transactionRepo.save(
        this.transactionRepo.create({
          walletId: withdrawal.walletId,
          amount: Number(withdrawal.amount),
          type: TransactionType.CREDIT,
          source: TransactionSource.REFUND,
          description: `Withdrawal refunded${rejectionReason ? ': ' + rejectionReason : ''}`,
          status: TransactionStatus.COMPLETED,
          referenceId: withdrawalId,
          balanceAfter: newBalance,
        }),
      );
      await this.logAudit({
        actorType: ActorType.ADMIN,
        actorId: adminId,
        action: 'withdrawal_rejected',
        entityType: 'withdrawal_request',
        entityId: withdrawalId,
        oldValue: { status: WithdrawalStatus.PENDING },
        newValue: { status: WithdrawalStatus.REJECTED, reason: rejectionReason },
      });
      const notification = await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: withdrawal.userId,
          type: NotificationType.WITHDRAWAL_REJECTED,
          title: 'Withdrawal Rejected',
          body: `Your withdrawal of Rs. ${withdrawal.amount} was rejected.${rejectionReason ? ' Reason: ' + rejectionReason + '.' : ''} Rs. ${withdrawal.amount} has been credited back to your wallet.`,
          data: { withdrawalId, status: 'rejected', reason: rejectionReason, userId: withdrawal.userId },
          triggerType: NotificationTriggerType.WITHDRAW,
        }),
      );
      this.notificationsService.sendToUser(withdrawal.userId, {
        title: notification.title,
        body: notification.body,
        data: notification.data ?? undefined,
        sound: 'default',
        priority: 'high',
      }).catch((pushErr) =>
        console.error('[AdminService] Failed to send withdrawal rejection push:', pushErr),
      );
      return { success: true, action: 'rejected', withdrawalId, status: WithdrawalStatus.REJECTED };
    }
  }

  /**
   * Retry a PROCESSING withdrawal via Razorpay.
   * On payout failure the withdrawal is marked FAILED (no auto-refund —
   * admin must explicitly call markWithdrawalFailed to refund the user).
   */
  async retryWithdrawal(adminId: string, withdrawalId: string): Promise<{
    success: boolean;
    withdrawalId: string;
    status: WithdrawalStatus;
    paymentFailed?: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
  }> {
    const withdrawal = await this.withdrawalRepo.findOne({
      where: { id: withdrawalId },
      relations: ['user', 'wallet'],
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal request not found');
    if (withdrawal.status !== WithdrawalStatus.PROCESSING) {
      throw new BadRequestException(`Cannot retry withdrawal in '${withdrawal.status}' status. Only PROCESSING withdrawals can be retried.`);
    }
    if (!withdrawal.orderId) {
      throw new BadRequestException('No orderId found for this withdrawal. Please re-approve the withdrawal first.');
    }

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: 'withdrawal_retry',
      entityType: 'withdrawal_request',
      entityId: withdrawalId,
      newValue: { action: 'retry_attempted', orderId: withdrawal.orderId },
    });

    // Fetch user's payment detail for fund account
    const paymentDetail = await this.paymentDetailRepo.findOne({
      where: { userId: withdrawal.userId, status: 'verified' },
      order: { verifiedAt: 'DESC' },
    });
    if (!paymentDetail) {
      throw new BadRequestException('No verified payment detail found for this user.');
    }

    // Reuse or recreate fund account
    let fundAccountId = paymentDetail.razorpayFundAccountId;
    if (!fundAccountId) {
      const fundAccount = await this.razorpayPayoutService.createFundAccount({
        userId: withdrawal.userId,
        phone: withdrawal.user.mobileNumber,
        name: withdrawal.user.name ?? 'User',
        existingContactId: withdrawal.user.razorpayContactId ?? undefined,
        vpa: paymentDetail.upiId ?? undefined,
        bankAccount:
          paymentDetail.ifsc && paymentDetail.accountNumberEncrypted
            ? {
                accountNumber: decrypt(paymentDetail.accountNumberEncrypted),
                ifsc: paymentDetail.ifsc,
                accountHolderName: paymentDetail.accountHolderName ?? '',
              }
            : undefined,
      });
      fundAccountId = fundAccount.fundAccountId;
      await this.paymentDetailRepo.update(paymentDetail.id, { razorpayFundAccountId: fundAccountId });
      if (!withdrawal.user.razorpayContactId) {
        await this.userRepo.update(withdrawal.userId, {
          razorpayContactId: fundAccount.contactId,
        });
      }
    }
    const referenceId = `wd_${withdrawalId}`;
    const amountPaise = Math.round(Number(withdrawal.amount) * 100);
    const payoutMode = withdrawal.payoutMethod === 'upi' ? 'UPI' : 'IMPS';

    let payoutResult: { payoutId: string; status: string; utrNumber?: string | null };
    try {
      payoutResult = await this.razorpayPayoutService.initiatePayout({
        fundAccountId,
        amount: amountPaise,
        referenceId,
        mode: payoutMode,
        narration: 'Withdrawal payout retry',
      });
    } catch (err) {
      const newStatus = await this.handleWithdrawalFailure({
        withdrawal,
        orderId: referenceId,
        adminId,
        result: {
          pinelabsTransactionId: null,
          errorCode: 'RAZORPAY_INIT_ERROR',
          errorMessage: err.message,
          rawResponse: {},
        },
      });
      return {
        success: true,
        withdrawalId,
        status: newStatus,
        paymentFailed: true,
        errorCode: 'RAZORPAY_INIT_ERROR',
        errorMessage: err.message,
      };
    }

    const { payoutId, status: razorpayStatus } = payoutResult;
    const finalStatus =
      razorpayStatus === 'success' || razorpayStatus === 'processed'
        ? WithdrawalStatus.COMPLETED
        : razorpayStatus === 'failed' || razorpayStatus === 'rejected'
        ? WithdrawalStatus.FAILED
        : WithdrawalStatus.PROCESSING;

    await this.withdrawalRepo.update(withdrawalId, {
      status: finalStatus,
      processedAt: finalStatus === WithdrawalStatus.COMPLETED ? new Date() : null,
      razorpayPayoutId: payoutId,
      utrNumber: payoutResult.utrNumber ?? null,
    });

    if (finalStatus === WithdrawalStatus.FAILED) {
      await this.handleWithdrawalFailure({
        withdrawal,
        orderId: referenceId,
        adminId,
        result: {
          pinelabsTransactionId: null,
          errorCode: `RAZORPAY_${razorpayStatus.toUpperCase()}`,
          errorMessage: `Razorpay payout status: ${razorpayStatus}`,
          rawResponse: { payoutId, razorpayStatus },
          utrNumber: payoutResult.utrNumber ?? null,
        },
      });
      return {
        success: true,
        withdrawalId,
        status: finalStatus,
        paymentFailed: true,
        errorCode: `RAZORPAY_${razorpayStatus.toUpperCase()}`,
        errorMessage: `Razorpay payout status: ${razorpayStatus}`,
      };
    }

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: 'withdrawal_completed',
      entityType: 'withdrawal_request',
      entityId: withdrawalId,
    });

    return { success: true, withdrawalId, status: finalStatus };
  }

  /**
   * Retry a FAILED withdrawal (one that was already refunded).
   * Resets to PROCESSING, creates a fresh DEBIT transaction, re-attempts payout.
   * If payout fails again, withdrawal is marked FAILED again — no auto-refund;
   * admin must explicitly call markWithdrawalFailed to refund.
   */
  async retryFailedWithdrawal(adminId: string, withdrawalId: string): Promise<{
    success: boolean;
    withdrawalId: string;
    status: WithdrawalStatus;
    paymentFailed?: boolean;
    errorCode?: string | null;
    errorMessage?: string | null;
  }> {
    const withdrawal = await this.withdrawalRepo.findOne({
      where: { id: withdrawalId },
      relations: ['user', 'wallet'],
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal request not found');
    if (withdrawal.status !== WithdrawalStatus.FAILED) {
      throw new BadRequestException(`Cannot retry-refund a withdrawal in '${withdrawal.status}' status. Only FAILED withdrawals can be retried.`);
    }

    // Use existing referenceId if present, otherwise build a new one
    const referenceId = withdrawal.orderId ?? `wd_${withdrawalId}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Reset withdrawal to PROCESSING and increment retry count
      await queryRunner.manager.update(WithdrawalRequest, withdrawalId, {
        status: WithdrawalStatus.PROCESSING,
        processedAt: new Date(),
        orderId: referenceId,
        razorpayPayoutId: null,
        retryCount: (withdrawal.retryCount ?? 0) + 1,
      });

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: 'withdrawal_retry_refund',
      entityType: 'withdrawal_request',
      entityId: withdrawalId,
      newValue: { action: 'retry_refund_attempted', orderId: referenceId },
    });

    // 2. Fetch user's payment detail for fund account
    const paymentDetail = await this.paymentDetailRepo.findOne({
      where: { userId: withdrawal.userId, status: 'verified' },
      order: { verifiedAt: 'DESC' },
    });
    if (!paymentDetail) {
      const newStatus = await this.handleWithdrawalFailure({
        withdrawal,
        orderId: referenceId,
        adminId,
        result: {
          pinelabsTransactionId: null,
          errorCode: 'NO_PAYMENT_DETAIL',
          errorMessage: 'No verified payment detail found for this user.',
          rawResponse: {},
        },
      });
      return { success: true, withdrawalId, status: newStatus, paymentFailed: true, errorCode: 'NO_PAYMENT_DETAIL', errorMessage: 'No verified payment detail found.' };
    }

    // 3. Reuse or recreate fund account
    let fundAccountId = paymentDetail.razorpayFundAccountId;
    if (!fundAccountId) {
      const fundAccount = await this.razorpayPayoutService.createFundAccount({
        userId: withdrawal.userId,
        phone: withdrawal.user.mobileNumber,
        name: withdrawal.user.name ?? 'User',
        existingContactId: withdrawal.user.razorpayContactId ?? undefined,
        vpa: paymentDetail.upiId ?? undefined,
        bankAccount:
          paymentDetail.ifsc && paymentDetail.accountNumberEncrypted
            ? {
                accountNumber: decrypt(paymentDetail.accountNumberEncrypted),
                ifsc: paymentDetail.ifsc,
                accountHolderName: paymentDetail.accountHolderName ?? '',
              }
            : undefined,
      });
      fundAccountId = fundAccount.fundAccountId;
      await this.paymentDetailRepo.update(paymentDetail.id, { razorpayFundAccountId: fundAccountId });
      if (!withdrawal.user.razorpayContactId) {
        await this.userRepo.update(withdrawal.userId, {
          razorpayContactId: fundAccount.contactId,
        });
      }
    }

    const amountPaise = Math.round(Number(withdrawal.amount) * 100);
    const payoutMode = withdrawal.payoutMethod === 'upi' ? 'UPI' : 'IMPS';

    let payoutResult: { payoutId: string; status: string; utrNumber?: string | null };
    try {
      payoutResult = await this.razorpayPayoutService.initiatePayout({
        fundAccountId,
        amount: amountPaise,
        referenceId,
        mode: payoutMode,
        narration: 'Withdrawal payout retry',
      });
    } catch (err) {
      const newStatus = await this.handleWithdrawalFailure({
        withdrawal,
        orderId: referenceId,
        adminId,
        result: {
          pinelabsTransactionId: null,
          errorCode: 'RAZORPAY_INIT_ERROR',
          errorMessage: err.message,
          rawResponse: {},
        },
      });
      return { success: true, withdrawalId, status: newStatus, paymentFailed: true, errorCode: 'RAZORPAY_INIT_ERROR', errorMessage: err.message };
    }

    const { payoutId, status: razorpayStatus } = payoutResult;
    const finalStatus =
      razorpayStatus === 'success' || razorpayStatus === 'processed'
        ? WithdrawalStatus.COMPLETED
        : razorpayStatus === 'failed' || razorpayStatus === 'rejected'
        ? WithdrawalStatus.FAILED
        : WithdrawalStatus.PROCESSING;

    await this.withdrawalRepo.update(withdrawalId, {
      status: finalStatus,
      processedAt: finalStatus === WithdrawalStatus.COMPLETED ? new Date() : null,
      razorpayPayoutId: payoutId,
      utrNumber: payoutResult.utrNumber ?? null,
    });

    if (finalStatus === WithdrawalStatus.FAILED) {
      const newStatus = await this.handleWithdrawalFailure({
        withdrawal,
        orderId: referenceId,
        adminId,
        result: {
          pinelabsTransactionId: null,
          errorCode: `RAZORPAY_${razorpayStatus.toUpperCase()}`,
          errorMessage: `Razorpay payout status: ${razorpayStatus}`,
          rawResponse: { payoutId, razorpayStatus },
          utrNumber: payoutResult.utrNumber ?? null,
        },
      });
      return {
        success: true,
        withdrawalId,
        status: newStatus,
        paymentFailed: true,
        errorCode: `RAZORPAY_${razorpayStatus.toUpperCase()}`,
        errorMessage: `Razorpay payout status: ${razorpayStatus}`,
      };
    }

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: 'withdrawal_completed',
      entityType: 'withdrawal_request',
      entityId: withdrawalId,
    });

    return { success: true, withdrawalId, status: finalStatus };
  }

  /**
   * Handle a PineLabs payout failure by:
   * 1. Logging to payment_logs
   * 2. Marking the withdrawal as FAILED
   *
   * No refund is issued here. The admin must explicitly call markWithdrawalFailed
   * to trigger the refund after reviewing the failure.
   *
   * Returns the new withdrawal status (always FAILED).
   */
  private async handleWithdrawalFailure(params: {
    withdrawal: WithdrawalRequest;
    orderId: string;
    adminId: string;
    result: { pinelabsTransactionId: string | null; errorCode: string | null; errorMessage: string | null; rawResponse: Record<string, unknown>; utrNumber?: string | null };
  }): Promise<WithdrawalStatus> {
    const { withdrawal, orderId, adminId, result } = params;

    // 1. Log failure to payment_logs
    await this.paymentLogRepo.save(
      this.paymentLogRepo.create({
        withdrawalRequestId: withdrawal.id,
        adminId,
        orderId,
        pinelabsTransactionId: result.pinelabsTransactionId,
        status: PaymentLogStatus.FAILED,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        rawResponse: result.rawResponse,
        utrNumber: result.utrNumber ?? null,
      }),
    );

    // 2. Mark withdrawal as FAILED — NO refund here; admin must explicitly call markWithdrawalFailed
    const failureReason = result.errorCode === 'NETWORK_ERROR'
      ? result.errorMessage ?? 'Payout dispatch failed'
      : `${result.errorCode ?? 'Payout failed'}: ${result.errorMessage ?? 'Unknown error'}`;

    await this.withdrawalRepo.update(withdrawal.id, {
      status: WithdrawalStatus.FAILED,
      failureReason,
    });
    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: 'withdrawal_payment_failed',
      entityType: 'withdrawal_request',
      entityId: withdrawal.id,
      newValue: { status: WithdrawalStatus.FAILED, reason: failureReason, refundPending: true },
    });

    // No notification here — notification is sent only after admin explicitly clicks "Mark Failed"
    return WithdrawalStatus.FAILED;
  }

  /**
   * Admin explicitly marks a PROCESSING withdrawal as FAILED.
   * Refunds balance to user and marks the corresponding transaction as FAILED.
   */
  async markWithdrawalFailed(adminId: string, withdrawalId: string, reason?: string): Promise<{ success: boolean; withdrawalId: string; status: WithdrawalStatus }> {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id: withdrawalId } });
    if (!withdrawal) throw new NotFoundException('Withdrawal request not found');
    if (withdrawal.status === WithdrawalStatus.FAILED) {
      // Idempotent: already failed — update the DEBIT and CREDIT (refund) transaction reasons
      if (reason) {
        await this.transactionRepo.update(
          { referenceId: withdrawalId, type: TransactionType.DEBIT },
          { rejectionReason: reason },
        );
        await this.transactionRepo.update(
          { referenceId: withdrawalId, type: TransactionType.CREDIT, source: TransactionSource.REFUND },
          { rejectionReason: reason },
        );
        await this.withdrawalRepo.update(withdrawalId, { failureReason: reason });
      }
      return { success: true, withdrawalId, status: WithdrawalStatus.FAILED };
    }
    if (withdrawal.status !== WithdrawalStatus.PROCESSING) {
      throw new BadRequestException(`Cannot mark withdrawal as failed in '${withdrawal.status}' status. Only PROCESSING withdrawals can be marked failed.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Mark withdrawal as FAILED
      await queryRunner.manager.update(WithdrawalRequest, withdrawalId, {
        status: WithdrawalStatus.FAILED,
        processedAt: new Date(),
        failureReason: reason ?? 'Marked failed by admin',
      });

      // 2. Mark the DEBIT transaction as FAILED and store the reason
      await queryRunner.manager.update(
        Transaction,
        { referenceId: withdrawalId, type: TransactionType.DEBIT },
        { status: TransactionStatus.FAILED, rejectionReason: reason ?? 'Marked failed by admin' },
      );

      // 3. Refund balance to wallet
      await queryRunner.manager
        .createQueryBuilder()
        .update(Wallet)
        .set({ balance: () => `balance + ${Number(withdrawal.amount)}` })
        .where('id = :id', { id: withdrawal.walletId })
        .execute();

      // 4. Fetch updated wallet for balanceAfter on refund tx
      const wallet = await queryRunner.manager.findOne(Wallet, { where: { id: withdrawal.walletId } });
      const newBalance = wallet ? Number(wallet.balance) : 0;

      // 5. Create refund CREDIT transaction
      await queryRunner.manager.save(
        queryRunner.manager.create(Transaction, {
          walletId: withdrawal.walletId,
          amount: Number(withdrawal.amount),
          type: TransactionType.CREDIT,
          source: TransactionSource.REFUND,
          description: `Withdrawal failed${reason ? ': ' + reason : ''}`,
          rejectionReason: reason ?? 'Marked failed by admin',
          status: TransactionStatus.COMPLETED,
          referenceId: withdrawalId,
          balanceAfter: newBalance,
        }),
      );

      await queryRunner.commitTransaction();

      // Send two notifications: one for failed withdrawal, one for refund
      const withdrawalForNotify = await this.withdrawalRepo.findOne({
        where: { id: withdrawalId },
        relations: ['user'],
      });
      if (withdrawalForNotify?.user) {
        const maskPayout = (details: Record<string, unknown> | null) => {
          if (!details) return {}
          return Object.fromEntries(
            Object.entries(details).map(([k, v]) => [
              k,
              typeof v === 'string' && v.length > 4
                ? v.slice(0, 2) + '****' + v.slice(-2)
                : v ?? '',
            ]),
          )
        }
        const maskedDetails = maskPayout(
          (withdrawalForNotify.payoutDetails as Record<string, unknown>) ?? null,
        )

        // 6a. Notify: withdrawal failed
        const failedNotification = await this.notificationRepo.save(
          this.notificationRepo.create({
            userId: withdrawalForNotify.userId,
            type: NotificationType.WITHDRAWAL_FAILED,
            title: 'Withdrawal Failed',
            body: `Your withdrawal of Rs. ${withdrawalForNotify.amount} has failed.${reason ? ' Reason: ' + reason + '.' : ''}`,
            data: {
              withdrawalId,
              status: 'failed',
              reason,
              payoutDetails: maskedDetails,
              userId: withdrawalForNotify.userId,
            },
            triggerType: NotificationTriggerType.WITHDRAW,
          }),
        )
        this.notificationsService.sendToUser(withdrawalForNotify.userId, {
          title: failedNotification.title,
          body: failedNotification.body,
          data: failedNotification.data ?? undefined,
        })

        // 6b. Notify: refund completed
        const refundNotification = await this.notificationRepo.save(
          this.notificationRepo.create({
            userId: withdrawalForNotify.userId,
            type: NotificationType.REFUND_COMPLETED,
            title: 'Refund Processed',
            body: `Rs. ${withdrawalForNotify.amount} has been credited back to your wallet.${reason ? ' Reason: ' + reason + '.' : ''}`,
            data: {
              withdrawalId,
              refundAmount: Number(withdrawalForNotify.amount),
              reason,
              payoutDetails: maskedDetails,
              userId: withdrawalForNotify.userId,
            },
            triggerType: NotificationTriggerType.WITHDRAW,
          }),
        )
        this.notificationsService.sendToUser(withdrawalForNotify.userId, {
          title: refundNotification.title,
          body: refundNotification.body,
          data: refundNotification.data ?? undefined,
        })
      }

      await this.logAudit({
        actorType: ActorType.ADMIN,
        actorId: adminId,
        action: 'withdrawal_marked_failed',
        entityType: 'withdrawal_request',
        entityId: withdrawalId,
        oldValue: { status: WithdrawalStatus.PROCESSING },
        newValue: { status: WithdrawalStatus.FAILED, reason },
      });

      return { success: true, withdrawalId, status: WithdrawalStatus.FAILED };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** Admin updates the failure reason on an already-failed withdrawal. */
  async updateWithdrawalFailureReason(
    adminId: string,
    withdrawalId: string,
    reason: string,
  ): Promise<{ success: boolean; withdrawalId: string }> {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id: withdrawalId } });
    if (!withdrawal) throw new NotFoundException('Withdrawal request not found');
    if (withdrawal.status !== WithdrawalStatus.FAILED) {
      throw new BadRequestException(
        `Can only update failure reason for FAILED withdrawals. Current status: ${withdrawal.status}`,
      );
    }

    // Update the rejection reason on the associated DEBIT transaction
    const debitTx = await this.transactionRepo.findOne({
      where: { referenceId: withdrawalId, type: TransactionType.DEBIT },
    });
    await this.transactionRepo.update(
      { referenceId: withdrawalId, type: TransactionType.DEBIT },
      { rejectionReason: reason },
    );

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: 'withdrawal_failure_reason_updated',
      entityType: 'withdrawal_request',
      entityId: withdrawalId,
      oldValue: { rejectionReason: debitTx?.rejectionReason ?? null },
      newValue: { rejectionReason: reason },
    });

    return { success: true, withdrawalId };
  }

  async listRewardLogs(dto: AnalyticsQueryDto) {
    const { fromDate, toDate, state, cropType } = dto;
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const qb = this.transactionRepo
      .createQueryBuilder('tx')
      .innerJoin('tx.wallet', 'w')
      .innerJoinAndSelect('w.user', 'u')
      .select([
        'tx.id',
        'tx.amount',
        'tx.type',
        'tx.source',
        'tx.description',
        'tx.status',
        'tx.referenceId',
        'tx.createdAt',
        'w.id',
      ])
      .where('tx.source = :source', { source: TransactionSource.REWARD })
      .andWhere('tx.createdAt BETWEEN :from AND :to', { from, to })
      .orderBy('tx.createdAt', 'DESC')
      .take(100);

    if (state) qb.andWhere('u.state = :state', { state });

    const items = await qb.getMany();

    return {
      items: items.map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        type: tx.type,
        source: tx.source,
        description: tx.description,
        status: tx.status,
        referenceId: tx.referenceId,
        createdAt: tx.createdAt,
        user: tx.wallet?.user ? { id: tx.wallet.user.id, name: tx.wallet.user.name, mobileNumber: tx.wallet.user.mobileNumber, state: tx.wallet.user.state } : null,
      })),
      from,
      to,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Section 6: Fraud Monitoring
  // ─────────────────────────────────────────────────────────────

  async getFraudStats(query: FraudQueryDto) {
    const { page = 1, limit = 20, state } = query;

    // Duplicate submissions (questions flagged as duplicates)
    const duplicateQb = this.questionRepo
      .createQueryBuilder('q')
      .innerJoin('q.user', 'u')
      .where('q.duplicateFlag = :flag', { flag: true })
      .select([
        'q.id',
        'q.questionText',
        'q.state',
        'q.submittedAt',
        'u.id as userId',
        'u.name as userName',
        'u.mobileNumber',
      ])
      .orderBy('q.submittedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (state) duplicateQb.andWhere('q.state = :state', { state });

    const [items, total] = await duplicateQb.getManyAndCount();

    const rejectedCount = await this.questionRepo.count({
      where: { status: QuestionStatus.REJECTED },
    });

    return {
      duplicateSubmissions: items,
      totalDuplicates: total,
      totalRejected: rejectedCount,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }


  // ─────────────────────────────────────────────────────────────
  // Section 8: Question Metrics (curator read-only)
  // ─────────────────────────────────────────────────────────────

  async getQuestionMetrics(query: AnalyticsQueryDto) {
    const { fromDate, toDate, state, cropType } = query;
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const baseWhere: Record<string, unknown> = {
      submittedAt: Between(from, to),
    };
    if (state) baseWhere['state'] = state;
    if (cropType) baseWhere['cropType'] = cropType;

    const [
      total,
      approved,
      rejected,
      pending,
      aiReview,
      humanReview,
      duplicates,
    ] = await Promise.all([
      this.questionRepo.count({ where: { ...baseWhere } }),
      this.questionRepo.count({ where: { ...baseWhere, status: QuestionStatus.APPROVED } }),
      this.questionRepo.count({ where: { ...baseWhere, status: QuestionStatus.REJECTED } }),
      this.questionRepo.count({ where: { ...baseWhere, status: QuestionStatus.PENDING } }),
      this.questionRepo.count({ where: { ...baseWhere, status: QuestionStatus.AI_REVIEW } }),
      this.questionRepo.count({ where: { ...baseWhere, status: QuestionStatus.HUMAN_REVIEW } }),
      this.questionRepo.count({ where: { ...baseWhere, duplicateFlag: true } }),
    ]);

    // Submission volume by day
    const dailyRaw: Array<{ date: string; total: string; approved: string; rejected: string }> = await this.questionRepo
      .createQueryBuilder('q')
      .select("TO_CHAR(q.submittedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'total')
      .addSelect("COUNT(CASE WHEN q.status = 'approved' THEN 1 END)", 'approved')
      .addSelect("COUNT(CASE WHEN q.status = 'rejected' THEN 1 END)", 'rejected')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .groupBy("TO_CHAR(q.submittedAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    // Top crops by volume
    const cropBreakdownRaw: Array<{ cropType: string; count: number }> = await this.questionRepo
      .createQueryBuilder('q')
      .select('q.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .groupBy('q.cropType')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    // State breakdown
    const stateBreakdownRaw: Array<{ state: string; count: number }> = await this.questionRepo
      .createQueryBuilder('q')
      .select('q.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .groupBy('q.state')
      .orderBy('count', 'DESC')
      .getRawMany();

    // Review turnaround (avg time from submittedAt to reviewedAt for approved/rejected)
    const avgTurnaroundRaw = await this.questionRepo
      .createQueryBuilder('q')
      .select('AVG(EXTRACT(EPOCH FROM (q.reviewedAt - q.submittedAt)))', 'avg_seconds')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .andWhere('q.reviewedAt IS NOT NULL')
      .andWhere('q.status IN (:...statuses)', {
        statuses: [QuestionStatus.APPROVED, QuestionStatus.REJECTED],
      })
      .getRawOne<{ avg_seconds: string | null }>();

    const avgTurnaroundSeconds = Number(avgTurnaroundRaw?.avg_seconds ?? 0);
    const avgTurnaroundMinutes = Math.round(avgTurnaroundSeconds / 60);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        total,
        approved,
        rejected,
        pending,
        inAiReview: aiReview,
        inHumanReview: humanReview,
        duplicates,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        rejectionRate: total > 0 ? Math.round((rejected / total) * 100) : 0,
      },
      dailyVolume: dailyRaw.map((r) => ({
        date: r.date,
        total: Number(r.total),
        approved: Number(r.approved),
        rejected: Number(r.rejected),
      })),
      cropBreakdown: cropBreakdownRaw.map((r) => ({
        cropType: r.cropType,
        count: Number(r.count),
      })),
      stateBreakdown: stateBreakdownRaw.map((r) => ({
        state: r.state,
        count: Number(r.count),
      })),
      avgReviewTurnaroundMinutes: avgTurnaroundMinutes || null,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Section 8c: Analytics (Task 11 — dedicated analytics endpoints)
  // ─────────────────────────────────────────────────────────────

  /**
   * All analytics dashboard data in a single call.
   * GET /analytics/dashboard  →  getAnalyticsDashboard
   */
  async getAnalyticsDashboard(query: AnalyticsQueryDto) {
    const [userAnalytics, questionAnalytics, rewardAnalytics] = await Promise.all([
      this.getUserAnalytics(query),
      this.getQuestionAnalytics(query),
      this.getRewardAnalytics(query),
    ]);

    // Dataset growth rate: approved questions this month vs last month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonthApproved, lastMonthApproved] = await Promise.all([
      this.questionRepo.count({
        where: {
          status: QuestionStatus.APPROVED,
          submittedAt: Between(thisMonthStart, now),
        },
      }),
      this.questionRepo.count({
        where: {
          status: QuestionStatus.APPROVED,
          submittedAt: Between(lastMonthStart, lastMonthEnd),
        },
      }),
    ]);

    const growthRate = lastMonthApproved > 0
      ? Math.round(((thisMonthApproved - lastMonthApproved) / lastMonthApproved) * 100)
      : thisMonthApproved > 0 ? 100 : 0;

    // Cost per approved question (total rewards paid / approved questions)
    const totalRewarded = rewardAnalytics.totalRewarded;
    const totalApproved = questionAnalytics.summary.approved;
    const costPerApproved = totalApproved > 0
      ? parseFloat((totalRewarded / totalApproved).toFixed(2))
      : 0;

    // State participation rate (distinct user-profile states with approved questions / 37)
    const statesWithSubmissions = await this.questionRepo
      .createQueryBuilder('q')
      .leftJoin('users', 'u', 'q.user_id = u.id')
      .select('COUNT(DISTINCT u.state)', 'count')
      .where('q.status = :status', { status: QuestionStatus.APPROVED })
      .getRawOne<{ count: string }>();

    // Indian states count reference (29 states + 8 UTs)
    const totalPossibleStates = 37;
    const participationRate = Math.round(
      (Number(statesWithSubmissions?.count ?? 0) / totalPossibleStates) * 100,
    );

    return {
      // Success metric cards
      totalRegisteredUsers: userAnalytics.totalUsers,
      monthlyActiveUsers: userAnalytics.mau,
      totalApprovedQuestions: questionAnalytics.summary.approved,
      totalRewarded: rewardAnalytics.totalRewarded,
      datasetGrowthRate: growthRate,
      costPerApprovedQuestion: costPerApproved,
      stateParticipationRate: participationRate,
      // Sub-analytics (for charts)
      users: userAnalytics,
      questions: questionAnalytics,
      rewards: rewardAnalytics,
    };
  }

  /**
   * User engagement: DAU, MAU, new signups, retention.
   * GET /analytics/users  →  getUserAnalytics
   */
  async getUserAnalytics(query: AnalyticsQueryDto) {
    const { fromDate, toDate, state } = query;
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const totalUsers = await this.userRepo.count();

    // MAU — distinct users who logged in (lastLoginAt) in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const mauRaw = await this.userRepo
      .createQueryBuilder('u')
      .select('COUNT(DISTINCT u.id)', 'count')
      .where('u.lastLoginAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .getRawOne<{ count: string }>();
    const mau = Number(mauRaw?.count ?? 0);

    // DAU — distinct users active today (lastLoginAt = today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dauRaw = await this.userRepo
      .createQueryBuilder('u')
      .select('COUNT(DISTINCT u.id)', 'count')
      .where('u.lastLoginAt >= :todayStart', { todayStart })
      .getRawOne<{ count: string }>();
    const dau = Number(dauRaw?.count ?? 0);

    // Daily signups for chart (last 30 days)
    const signupRaw: Array<{ date: string; signups: string }> = await this.userRepo
      .createQueryBuilder('u')
      .select("TO_CHAR(u.createdAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'signups')
      .where('u.createdAt >= :from', { from })
      .groupBy("TO_CHAR(u.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    // DAU per day for chart (users who logged in each day)
    const dauRawDaily: Array<{ date: string; dau: string }> = await this.userRepo
      .createQueryBuilder('u')
      .select("TO_CHAR(u.lastLoginAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(DISTINCT u.id)', 'dau')
      .where('u.lastLoginAt >= :from', { from })
      .groupBy("TO_CHAR(u.lastLoginAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    const dauMap = new Map(dauRawDaily.map((r) => [r.date, Number(r.dau)]));

    const signupTrend = signupRaw.map((r) => ({
      date: r.date,
      signups: Number(r.signups),
      dau: dauMap.get(r.date) ?? 0,
    }));

    // New signups in current period vs prior period (for growth delta)
    const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
    const priorFrom = new Date(from.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const priorTo = new Date(from.getTime() - 1);
    const priorSignupsRaw = await this.userRepo
      .createQueryBuilder('u')
      .select('COUNT(*)', 'count')
      .where('u.createdAt BETWEEN :priorFrom AND :priorTo', { priorFrom, priorTo })
      .getRawOne<{ count: string }>();
    const priorSignups = Number(priorSignupsRaw?.count ?? 0);
    const currSignups = signupRaw.reduce((s, r) => s + Number(r.signups), 0);
    const signupGrowth = priorSignups > 0
      ? Math.round(((currSignups - priorSignups) / priorSignups) * 100)
      : currSignups > 0 ? 100 : 0;

    // State breakdown
    let stateQb = this.userRepo.createQueryBuilder('u').select('u.state', 'state').addSelect('COUNT(*)', 'count').groupBy('u.state').orderBy('count', 'DESC');
    if (state) stateQb = stateQb.andWhere('u.state = :state', { state });
    const stateBreakdown: Array<{ state: string; count: number }> = (await stateQb.getRawMany()).map((r) => ({ state: r.state, count: Number(r.count) }));

    // District breakdown (top 20 per state if filtered, else overall top 20)
    let districtQb = this.userRepo.createQueryBuilder('u')
      .select('u.district', 'district')
      .addSelect('u.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.district')
      .addGroupBy('u.state')
      .orderBy('count', 'DESC')
      .limit(50);
    if (state) districtQb = districtQb.andWhere('u.state = :state', { state });
    const districtBreakdownRaw: Array<{ district: string; state: string; count: string }> = await districtQb.getRawMany();
    const districtBreakdown = districtBreakdownRaw
      .filter((r) => r.district != null)
      .map((r) => ({ district: r.district, state: r.state, count: Number(r.count) }));

    // Category breakdown
    const categoryBreakdownRaw = await this.userRepo
      .createQueryBuilder('u')
      .select('u.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.category')
      .orderBy('count', 'DESC')
      .getRawMany();
    const categoryBreakdown = categoryBreakdownRaw.filter((r) => r.category != null).map((r) => ({ category: r.category as UserCategory, count: Number(r.count) }));

    // Role distribution
    const roleDistributionRaw = await this.userRepo
      .createQueryBuilder('u')
      .select('u.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.role')
      .getRawMany();
    const roleDistribution = roleDistributionRaw.map((r) => ({ role: r.role as UserRole, count: Number(r.count) }));

    return {
      totalUsers,
      mau,
      dau,
      signupGrowth,
      signupTrend,
      stateBreakdown,
      districtBreakdown,
      categoryBreakdown,
      roleDistribution,
    };
  }

  /**
   * Question volume + breakdown by state, crop, domain.
   * GET /analytics/questions  →  getQuestionAnalytics
   */
  async getQuestionAnalytics(query: AnalyticsQueryDto) {
    const { fromDate, toDate, state, cropType } = query;
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const baseWhere: Record<string, unknown> = { submittedAt: Between(from, to) };
    if (state) baseWhere['state'] = state;
    if (cropType) baseWhere['cropType'] = cropType;

    const [total, approved, rejected, pending] = await Promise.all([
      this.questionRepo.count({ where: { ...baseWhere } }),
      this.questionRepo.count({ where: { ...baseWhere, status: QuestionStatus.APPROVED } }),
      this.questionRepo.count({ where: { ...baseWhere, status: QuestionStatus.REJECTED } }),
      this.questionRepo.count({ where: { status: In([QuestionStatus.PENDING, QuestionStatus.AI_REVIEW, QuestionStatus.HUMAN_REVIEW]) } }),
    ]);

    // Daily volume: submitted, approved, rejected per day
    const dailyRaw: Array<{ date: string; submitted: string; approved: string; rejected: string }> = await this.questionRepo
      .createQueryBuilder('q')
      .select("TO_CHAR(q.submittedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'submitted')
      .addSelect("COUNT(CASE WHEN q.status = 'approved' THEN 1 END)", 'approved')
      .addSelect("COUNT(CASE WHEN q.status = 'rejected' THEN 1 END)", 'rejected')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .groupBy("TO_CHAR(q.submittedAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    const dailyVolume = dailyRaw.map((r) => ({
      date: r.date,
      submitted: Number(r.submitted),
      approved: Number(r.approved),
      rejected: Number(r.rejected),
    }));

    // State breakdown (top 20)
    let stateQb = this.questionRepo
      .createQueryBuilder('q')
      .select('q.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .addSelect("COUNT(CASE WHEN q.status = 'approved' THEN 1 END)", 'approved')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .groupBy('q.state')
      .orderBy('count', 'DESC')
      .limit(20);
    if (state) stateQb = stateQb.andWhere('q.state = :state', { state });
    const stateBreakdown: Array<{ state: string; count: number; approved: number }> = (
      await stateQb.getRawMany()
    ).map((r) => ({ state: r.state, count: Number(r.count), approved: Number(r.approved) }));

    // Crop-type breakdown (top 15)
    let cropQb = this.questionRepo
      .createQueryBuilder('q')
      .select('q.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .addSelect("COUNT(CASE WHEN q.status = 'approved' THEN 1 END)", 'approved')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .groupBy('q.cropType')
      .orderBy('count', 'DESC')
      .limit(15);
    if (cropType) cropQb = cropQb.andWhere('q.cropType = :cropType', { cropType });
    const cropBreakdown: Array<{ cropType: string; count: number; approved: number }> = (
      await cropQb.getRawMany()
    ).map((r) => ({ cropType: r.cropType, count: Number(r.count), approved: Number(r.approved) }));

    // Domain category breakdown
    const domainBreakdownRaw = await this.questionRepo
      .createQueryBuilder('q')
      .select('unnest(q.domains)', 'domain')
      .addSelect('COUNT(*)', 'count')
      .addSelect("COUNT(CASE WHEN q.status = 'approved' THEN 1 END)", 'approved')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .groupBy('unnest(q.domains)')
      .orderBy('count', 'DESC')
      .getRawMany();
    const domainBreakdown = domainBreakdownRaw.map((r) => ({
      domain: r.domain,
      count: Number(r.count),
      approved: Number(r.approved),
    }));

    // District breakdown (top 20 per state if filtered, else overall top 20)
    let districtQb = this.questionRepo
      .createQueryBuilder('q')
      .select('q.district', 'district')
      .addSelect('q.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .addSelect("COUNT(CASE WHEN q.status = 'approved' THEN 1 END)", 'approved')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .groupBy('q.district')
      .addGroupBy('q.state')
      .orderBy('count', 'DESC')
      .limit(50);
    if (state) districtQb = districtQb.andWhere('q.state = :state', { state });
    const districtBreakdown: Array<{ district: string; state: string; count: number; approved: number }> = (
      await districtQb.getRawMany()
    )
      .filter((r) => r.district != null)
      .map((r) => ({ district: r.district, state: r.state, count: Number(r.count), approved: Number(r.approved) }));

    // Approval rate
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    // Month-over-month growth
    const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
    const priorFrom = new Date(from.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const priorTo = new Date(from.getTime() - 1);
    const priorApproved = await this.questionRepo.count({
      where: { status: QuestionStatus.APPROVED, submittedAt: Between(priorFrom, priorTo) },
    });
    const growthRate = priorApproved > 0
      ? Math.round(((approved - priorApproved) / priorApproved) * 100)
      : approved > 0 ? 100 : 0;

    return {
      summary: {
        total,
        approved,
        rejected,
        pending,
        approvalRate,
        growthRate,
      },
      dailyVolume,
      stateBreakdown,
      districtBreakdown,
      cropBreakdown,
      domainBreakdown,
    };
  }

  /**
   * Reward and payout analytics.
   * GET /analytics/rewards  →  getRewardAnalytics
   */
  async getRewardAnalytics(query: AnalyticsQueryDto) {
    const { fromDate, toDate, state } = query;
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const txWhere: Record<string, unknown> = {
      source: TransactionSource.REWARD,
      status: 'completed',
      createdAt: Between(from, to),
    };

    let txQb = this.transactionRepo
      .createQueryBuilder('tx')
      .innerJoin('tx.wallet', 'w')
      .innerJoinAndSelect('w.user', 'u')
      .select([
        'SUM(tx.amount) as total_rewarded',
        'COUNT(tx.id) as reward_count',
        'AVG(tx.amount) as avg_reward',
        "TO_CHAR(tx.createdAt, 'YYYY-MM-DD') as date",
      ])
      .where('tx.source = :source', { source: TransactionSource.REWARD })
      .andWhere('tx.status = :status', { status: 'completed' })
      .andWhere('tx.createdAt BETWEEN :from AND :to', { from, to })
      .groupBy("TO_CHAR(tx.createdAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC');

    if (state) txQb = txQb.andWhere('u.state = :state', { state });

    const rewardTxsRaw = await txQb.getRawMany<{ total_rewarded: string; reward_count: string; avg_reward: string; date: string }>();

    const totalRewarded = rewardTxsRaw.reduce((s, r) => s + Number(r.total_rewarded), 0);
    const rewardCount = rewardTxsRaw.reduce((s, r) => s + Number(r.reward_count), 0);
    const avgReward = rewardCount > 0 ? parseFloat((totalRewarded / rewardCount).toFixed(2)) : 0;

    // Daily reward trend
    const dailyRewardTrend = rewardTxsRaw.map((r) => ({
      date: r.date,
      amount: Number(r.total_rewarded),
      count: Number(r.reward_count),
    }));

    // Withdrawal stats
    const withdrawalStats = await this.withdrawalRepo
      .createQueryBuilder('wr')
      .select([
        'COALESCE(SUM(wr.amount), 0) as total_withdrawn',
        'COUNT(wr.id) as withdrawal_count',
        "COUNT(CASE WHEN wr.status = 'pending' THEN 1 END) as pending_count",
        "COUNT(CASE WHEN wr.status = 'completed' THEN 1 END) as completed_count",
        "COUNT(CASE WHEN wr.status = 'failed' THEN 1 END) as failed_count",
      ])
      .where('wr.createdAt BETWEEN :from AND :to', { from, to })
      .getRawOne();

    // Total pool (all-time rewards)
    const totalPoolRaw = await this.transactionRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.source = :source', { source: TransactionSource.REWARD })
      .andWhere('tx.status = :status', { status: 'completed' })
      .getRawOne<{ total: string }>();
    const totalPool = Number(totalPoolRaw?.total ?? 0);

    return {
      totalRewarded: parseFloat(totalRewarded.toFixed(2)),
      rewardCount,
      avgReward,
      totalPool,
      dailyRewardTrend,
      withdrawals: {
        totalWithdrawn: Number(withdrawalStats?.total_withdrawn ?? 0),
        withdrawalCount: Number(withdrawalStats?.withdrawal_count ?? 0),
        pending: Number(withdrawalStats?.pending_count ?? 0),
        completed: Number(withdrawalStats?.completed_count ?? 0),
        failed: Number(withdrawalStats?.failed_count ?? 0),
      },
    };
  }

  private toCSV(rows: Record<string, unknown>[], columns: string[]): string {
    const header = columns.join(',');
    const lines = rows.map((row) =>
      columns.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(','),
    );
    return [header, ...lines].join('\n');
  }

  /**
   * Export with true Excel support (json2xls).
   * Returns { format, data: string } for CSV, { format, xls: Buffer } for Excel.
   */
  async exportData(dto: ExportQueryDto) {
    const { fromDate, toDate, state, cropType, format = 'csv', dataType = 'questions' } = dto;
    const from = fromDate ? new Date(fromDate) : new Date(0);
    const to = toDate ? new Date(toDate) : new Date();

    let rows: Record<string, unknown>[];
    let columns: string[];

    if (dataType === 'questions') {
      const qb = this.questionRepo
        .createQueryBuilder('q')
        .leftJoinAndSelect('q.user', 'u')
        .select([
          'q.id',
          'u.mobileNumber',
          'u.name',
          'q.questionText',
          'q.language',
          'q.domains',
          'q.cropType',
          'q.season',
          'q.state',
          'q.district',
          'q.mediaType',
          'q.status',
          'q.submittedAt',
          'q.reviewedAt',
          'q.rejectionReason',
          'q.heldReason',
          'q.approvalReason',
        ])
        .where('q.submittedAt BETWEEN :from AND :to', { from, to })
        .orderBy('q.submittedAt', 'DESC');
      if (state) qb.andWhere('q.state = :state', { state });
      if (cropType) qb.andWhere('q.cropType = :cropType', { cropType });
      rows = await qb.getMany() as unknown as Record<string, unknown>[];
      columns = [
        'id', 'mobileNumber', 'name', 'questionText', 'language',
        'domains', 'cropType', 'season', 'state', 'district',
        'mediaType', 'status', 'submittedAt', 'reviewedAt',
        'rejectionReason', 'heldReason', 'approvalReason',
      ];
    } else if (dataType === 'users') {
      const qb = this.userRepo
        .createQueryBuilder('u')
        .select([
          'u.id', 'u.mobileNumber', 'u.name', 'u.category', 'u.state',
          'u.district', 'u.verificationStatus', 'u.role', 'u.createdAt', 'u.lastLoginAt',
        ])
        .where('u.createdAt BETWEEN :from AND :to', { from, to })
        .orderBy('u.createdAt', 'DESC');
      if (state) qb.andWhere('u.state = :state', { state });
      rows = await qb.getMany() as unknown as Record<string, unknown>[];
      columns = ['id', 'mobileNumber', 'name', 'category', 'state', 'district', 'verificationStatus', 'role', 'createdAt', 'lastLoginAt'];
    } else if (dataType === 'rewards') {
      const qb = this.transactionRepo
        .createQueryBuilder('tx')
        .innerJoin('tx.wallet', 'w')
        .innerJoinAndSelect('w.user', 'u')
        .select([
          'tx.id', 'u.mobileNumber', 'u.name', 'tx.amount',
          'tx.type', 'tx.source', 'tx.description', 'tx.status', 'tx.referenceId', 'tx.createdAt',
        ])
        .where('tx.source = :source', { source: TransactionSource.REWARD })
        .andWhere('tx.createdAt BETWEEN :from AND :to', { from, to })
        .orderBy('tx.createdAt', 'DESC');
      if (state) qb.andWhere('u.state = :state', { state });
      rows = await qb.getMany() as unknown as Record<string, unknown>[];
      columns = ['id', 'mobileNumber', 'name', 'amount', 'type', 'source', 'description', 'status', 'referenceId', 'createdAt'];
    } else {
      const qb = this.withdrawalRepo
        .createQueryBuilder('wr')
        .leftJoinAndSelect('wr.user', 'u')
        .leftJoin('Transaction', 'tx', 'tx.reference_id = CAST(wr.id AS varchar) AND tx.type = :debitType', { debitType: TransactionType.DEBIT })
        .select([
          'wr.id', 'u.mobileNumber', 'u.name', 'wr.amount',
          'wr.payoutMethod', 'wr.status', 'wr.createdAt', 'wr.processedAt', 'tx.rejectionReason',
        ])
        .where('wr.createdAt BETWEEN :from AND :to', { from, to })
        .orderBy('wr.createdAt', 'DESC');
      if (state) qb.andWhere('u.state = :state', { state });
      rows = await qb.getMany() as unknown as Record<string, unknown>[];
      columns = ['id', 'mobileNumber', 'name', 'amount', 'payoutMethod', 'status', 'createdAt', 'processedAt', 'rejectionReason'];
    }

    if (format === 'csv') {
      return { format: 'csv', data: this.toCSV(rows, columns) };
    }

    // Excel via json2xls
    const json2xls = require('json2xls');
    const xls = json2xls(rows, {
      fields: columns.reduce((acc, col) => ({ ...acc, [col]: col }), {} as Record<string, string>),
    });
    return { format: 'excel', xls: xls as unknown as string };
  }

  // ─────────────────────────────────────────────────────────────
  // Section 8b: Wallet Management (super_admin only for adjustments)
  // ─────────────────────────────────────────────────────────────

  async getUserWallet(userId: string) {
    const wallet = await this.walletRepo.findOne({
      where: { userId },
      relations: ['user'],
      select: ['id', 'balance', 'createdAt', 'updatedAt'],
    });
    if (!wallet) throw new NotFoundException('Wallet not found for this user');

    // Aggregate total earned (completed credits from rewards + refunds)
    const earnedAgg = await this.transactionRepo
      .createQueryBuilder('tx')
      .where('tx.walletId = :walletId', { walletId: wallet.id })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.type = :type', { type: TransactionType.CREDIT })
      .andWhere('tx.source IN (:...sources)', {
        sources: [TransactionSource.REWARD, TransactionSource.REFUND],
      })
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .getRawOne();

    // Aggregate total withdrawn (completed debits from withdrawals)
    const withdrawnAgg = await this.transactionRepo
      .createQueryBuilder('tx')
      .where('tx.walletId = :walletId', { walletId: wallet.id })
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.type = :type', { type: TransactionType.DEBIT })
      .andWhere('tx.source = :source', { source: TransactionSource.WITHDRAWAL })
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .getRawOne();

    return {
      id: wallet.id,
      balance: Number(wallet.balance),
      totalEarned: Number(earnedAgg?.total ?? 0),
      totalWithdrawn: Number(withdrawnAgg?.total ?? 0),
      currency: 'INR',
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
      user: wallet.user
        ? {
            id: wallet.user.id,
            name: wallet.user.name,
            mobileNumber: wallet.user.mobileNumber,
            state: wallet.user.state,
            district: wallet.user.district,
            category: wallet.user.category,
            role: wallet.user.role,
            verificationStatus: wallet.user.verificationStatus,
          }
        : null,
    };
  }

  async getWithdrawalWithTransactions(id: string) {
    const withdrawal = await this.withdrawalRepo.findOne({
      where: { id },
      relations: ['user', 'paymentLogs'],
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal request not found');

    const transactions = await this.transactionRepo.find({
      where: { referenceId: id },
      order: { createdAt: 'ASC' },
    });

    const paymentLogs = (withdrawal.paymentLogs ?? []).map((pl) => ({
      id: pl.id,
      orderId: pl.orderId,
      pinelabsTransactionId: pl.pinelabsTransactionId,
      razorpayPayoutId: pl.razorpayPayoutId,
      utrNumber: pl.utrNumber,
      status: pl.status,
      errorCode: pl.errorCode,
      errorMessage: pl.errorMessage,
      rawResponse: pl.rawResponse,
      attemptedAt: pl.attemptedAt,
    }));

    return {
      ...withdrawal,
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: Number(tx.amount),
        status: tx.status,
        rejectionReason: tx.rejectionReason,
        description: tx.description,
        source: tx.source,
        createdAt: tx.createdAt,
      })),
      paymentLogs,
    };
  }

  async listUserTransactions(userId: string, dto: ListUserTransactionsDto) {
    const {
      page = 1, limit = 50,
      type, status, source,
      fromDate, toDate,
      sortBy = 'createdAt', sortOrder = 'DESC',
    } = dto;

    // Verify user/wallet exists
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for this user');

    const qb = this.transactionRepo
      .createQueryBuilder('tx')
      .where('tx.walletId = :walletId', { walletId: wallet.id })
      .select([
        'tx.id',
        'tx.amount',
        'tx.type',
        'tx.source',
        'tx.description',
        'tx.status',
        'tx.referenceId',
        'tx.balanceAfter',
        'tx.createdAt',
      ])
      .skip((page - 1) * limit)
      .take(limit);

    if (type && type !== 'all') qb.andWhere('tx.type = :type', { type });
    if (status && status !== 'all') qb.andWhere('tx.status = :status', { status });
    if (source && source !== 'all') qb.andWhere('tx.source = :source', { source });
    if (fromDate) qb.andWhere('tx.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
    if (toDate) qb.andWhere('tx.createdAt <= :toDate', { toDate: new Date(toDate) });

    const sortCol = sortBy === 'amount' ? 'tx.amount' : 'tx.createdAt';
    qb.orderBy(sortCol, sortOrder);

    const [items, total] = await qb.getManyAndCount();

    // Compute summary
    const summary = await this.transactionRepo
      .createQueryBuilder('tx')
      .where('tx.walletId = :walletId', { walletId: wallet.id })
      .select(
        `
        COUNT(*) as "totalCount",
        SUM(CASE WHEN tx.type = 'credit' THEN tx.amount ELSE 0 END) as "totalCredits",
        SUM(CASE WHEN tx.type = 'debit' THEN tx.amount ELSE 0 END) as "totalDebits",
        SUM(CASE WHEN tx.status = 'completed' AND tx.type = 'credit' THEN tx.amount ELSE 0 END) as "completedCredits",
        SUM(CASE WHEN tx.status = 'completed' AND tx.type = 'debit' THEN tx.amount ELSE 0 END) as "completedDebits"
      `,
      )
      .getRawOne();

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      summary: {
        totalTransactions: Number(summary.totalCount) || 0,
        totalCredits: Number(summary.totalCredits) || 0,
        totalDebits: Number(summary.totalDebits) || 0,
        completedCredits: Number(summary.completedCredits) || 0,
        completedDebits: Number(summary.completedDebits) || 0,
      },
    };
  }

  async listUserWithdrawals(userId: string, dto: ListUserWithdrawalsDto) {
    const { page = 1, limit = 20, status, fromDate, toDate } = dto;

    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for this user');

    const qb = this.withdrawalRepo
      .createQueryBuilder('wr')
      .where('wr.walletId = :walletId', { walletId: wallet.id })
      .select([
        'wr.id',
        'wr.amount',
        'wr.payoutMethod',
        'wr.payoutDetails',
        'wr.status',
        'wr.processedAt',
        'wr.createdAt',
        'wr.utrNumber',
        'wr.razorpayPayoutId',
      ])
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('wr.status = :status', { status });
    if (fromDate) qb.andWhere('wr.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
    if (toDate) qb.andWhere('wr.createdAt <= :toDate', { toDate: new Date(toDate) });

    qb.orderBy('wr.createdAt', 'DESC');

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async adjustWalletBalance(adminId: string, dto: AdjustWalletDto) {
    const isSuperAdmin = await this.isSuperAdmin(adminId);
    // if (!isSuperAdmin) 
    throw new ForbiddenException('Only super admins can manually adjust wallet balances');

    const wallet = await this.walletRepo.findOne({ where: { userId: dto.userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for this user');

    // Extract non-null values immediately after the guard — TypeScript cannot narrow across await
    const walletId = wallet!.id;
    const initialBalance = Number(wallet!.balance);
    let currentBalance = initialBalance;

    const amount = Number(dto.amount);
    if (amount === 0) throw new BadRequestException('Adjustment amount cannot be zero');

    if (amount > 0) {
      await this.walletRepo.increment({ id: walletId }, 'balance', amount);
      currentBalance += amount;
      await this.transactionRepo.save({
        walletId,
        amount,
        type: TransactionType.CREDIT,
        source: TransactionSource.ADJUSTMENT,
        status: TransactionStatus.COMPLETED,
        description: dto.description ?? `Manual adjustment: ${dto.reason}`,
        balanceAfter: currentBalance,
      });
    } else {
      const debit = Math.abs(amount);
      if (currentBalance < debit) {
        throw new BadRequestException('Insufficient balance for this debit adjustment');
      }
      await this.walletRepo.decrement({ id: walletId }, 'balance', debit);
      currentBalance -= debit;
      await this.transactionRepo.save({
        walletId,
        amount: debit,
        type: TransactionType.DEBIT,
        source: TransactionSource.ADJUSTMENT,
        status: TransactionStatus.COMPLETED,
        description: dto.description ?? `Manual adjustment: ${dto.reason}`,
        balanceAfter: currentBalance,
      });
    }

    const updatedWallet = await this.walletRepo.findOne({ where: { id: walletId } });

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: 'wallet_balance_adjusted',
      entityType: 'wallet',
      entityId: walletId,
      oldValue: { balance: initialBalance },
      newValue: { balance: Number(updatedWallet!.balance) },
      metadata: { reason: dto.reason, adjustmentAmount: amount },
    });

    return {
      success: true,
      userId: dto.userId,
      walletId,
      previousBalance: initialBalance,
      newBalance: Number(updatedWallet!.balance),
      adjustment: amount,
      reason: dto.reason,
    };
  }

  async listAllWallets(dto: ListAllWalletsDto) {
    const {
      page = 1, limit = 50, userId, search, state,
      sortBy = 'createdAt', sortOrder = 'DESC',
    } = dto;

    const qb = this.walletRepo
      .createQueryBuilder('w')
      .innerJoinAndSelect('w.user', 'u')
      .leftJoin('w.transactions', 'tx')
      .select([
        'w.id',
        'w.balance',
        'w.createdAt',
        'w.updatedAt',
        'u.id',
        'u.name',
        'u.mobileNumber',
        'u.state',
        'u.district',
        'u.category',
        'u.role',
        'u.verificationStatus',
        'u.createdAt',
      ])
      .addSelect(
        "COALESCE(SUM(CASE WHEN tx.type = 'CREDIT' AND tx.source = 'REWARD' AND tx.status = 'COMPLETED' THEN tx.amount ELSE 0 END), 0)",
        'totalEarned',
      )
      .addSelect(
        "COALESCE(SUM(CASE WHEN tx.type = 'DEBIT' AND tx.source = 'WITHDRAWAL' AND tx.status = 'COMPLETED' THEN tx.amount ELSE 0 END), 0)",
        'totalWithdrawn',
      )
      .groupBy('w.id')
      .addGroupBy('u.id')
      .skip((page - 1) * limit)
      .take(limit);

    if (userId) qb.andWhere('u.id = :userId', { userId });
    if (search) {
      qb.andWhere(
        `(u.name ILIKE :search OR u.mobileNumber ILIKE :search)`,
        { search: `%${search}%` },
      );
    }
    if (state) qb.andWhere('u.state = :state', { state });

    const sortCol = sortBy === 'balance' ? 'w.balance' : 'w.createdAt';
    qb.orderBy(sortCol, sortOrder);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((w) => ({
        id: w.id,
        userId: w.user.id,
        balance: Number(w.balance),
        totalEarned: Number((w as unknown as { totalEarned: string }).totalEarned ?? 0),
        totalWithdrawn: Number((w as unknown as { totalWithdrawn: string }).totalWithdrawn ?? 0),
        user: {
          id: w.user.id,
          name: w.user.name,
          mobileNumber: w.user.mobileNumber,
          state: w.user.state,
          district: w.user.district,
          category: w.user.category,
          role: w.user.role,
          verificationStatus: (w.user as { verificationStatus: string }).verificationStatus,
          createdAt: w.user.createdAt,
        },
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Section 9: Helpers
  // ─────────────────────────────────────────────────────────────

  private async isSuperAdmin(adminId: string): Promise<boolean> {
    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    return admin?.role === UserRole.SUPER_ADMIN;
  }

  private toPublicUser(user: User): Record<string, unknown> {
    return {
      id: user.id,
      mobileNumber: user.mobileNumber,
      name: user.name,
      category: user.category,
      state: user.state,
      district: user.district,
      block: user.block,
      village: user.village,
      kvk: user.kvk,
      languagePreference: user.languagePreference,
      verificationStatus: user.verificationStatus,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private async logAudit(params: {
    actorType: ActorType;
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }) {
    await this.auditRepo.save({
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
      metadata: params.metadata ?? null,
    });
  }

  /** Flush cache keys matching a pattern. Super admin only. */
  async flushCache(keyPattern: string): Promise<{ flushed: number }> {
    const count = await this.redisService.delByPattern(keyPattern);
    this.logger.log(`Cache flush: ${count} keys deleted matching "${keyPattern}"`);
    return { flushed: count };
  }
}