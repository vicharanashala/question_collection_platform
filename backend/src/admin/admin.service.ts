import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, ILike, Between, In } from 'typeorm';
import {
  User,
  Question,
  Wallet,
  Transaction,
  WithdrawalRequest,
  AuditLog,
  AdminConfig,
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

// Config key constants — mirrors database.md defaults
const DEFAULT_CONFIG: Record<string, { value: number; description: string }> = {
  max_users_per_state: { value: 100, description: 'Maximum registered users per state' },
  min_withdrawal_amount: { value: 50, description: 'Minimum withdrawal threshold (INR)' },
  question_edit_window_seconds: { value: 30, description: 'Edit window after submission (seconds)' },
  daily_question_limit: { value: 20, description: 'Max questions per user per day' },
  ai_confidence_threshold: { value: 90, description: 'Minimum AI confidence to auto-approve (%)' },
  duplicate_similarity_threshold: { value: 0.9, description: 'Semantic similarity threshold for duplicate detection' },
  video_max_duration_seconds: { value: 10, description: 'Maximum video duration (seconds)' },
  video_max_size_mb: { value: 10, description: 'Maximum video file size (MB)' },
  max_question_chars: { value: 1000, description: 'Maximum characters allowed in a question' },
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
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WalletsService))
    private readonly walletsService: WalletsService,
  ) {}

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
      block?: string;
      languagePreference?: string;
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
      languagePreference: dto.languagePreference ?? 'en',
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
        'category', 'district', 'state', 'languagePreference',
        'createdAt', 'lastLoginAt',
        'suspendedAt', 'suspendedUntil', 'suspendedReason',
        'bannedAt', 'bannedReason',
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
        'aiConfidenceScore',
        'submittedAt',
        'reviewedAt',
        'rejectionReason',
      ],
    });

    return { user, questions };
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

  async verifyUser(adminId: string, userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const oldStatus = user.verificationStatus;
    if (oldStatus === VerificationStatus.VERIFIED) {
      return { success: true, userId, newStatus: oldStatus, message: 'User already verified' };
    }

    await this.userRepo.update(userId, { verificationStatus: VerificationStatus.VERIFIED });

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
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
        'q.aiConfidenceScore',
        'q.submittedAt',
        'q.reviewedAt',
        'q.rejectionReason',
        'q.heldReason',
        'q.approvalReason',
        'q.language',
        'q.domainCategory',
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
      sortBy === 'aiConfidenceScore' ? 'q.aiConfidenceScore'
      : sortBy === 'state' ? 'q.state'
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

      await this.logAudit({
        actorType,
        actorId: reviewerId,
        action: AuditAction.QUESTION_APPROVED,
        entityType: 'question',
        entityId: questionId,
        oldValue: { status: oldStatus },
        newValue: { status: QuestionStatus.APPROVED, reward: rewardResult.transaction.amount },
      });

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
      await this.logAudit({
        actorType,
        actorId: reviewerId,
        action: AuditAction.QUESTION_REJECTED,
        entityType: 'question',
        entityId: questionId,
        oldValue: { status: oldStatus },
        newValue: { status: QuestionStatus.REJECTED, reason: dto.reason },
      });
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
      recentActivity: [],
      roleDistribution: roleDist.map((r) => ({ role: r.role as UserRole, count: Number(r.count) })),
      categoryDistribution: categoryDist
        .filter((c) => c.category != null)
        .map((c) => ({ category: c.category as UserCategory, count: Number(c.count) })),
      historical: historicalDays,
    }
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
      fromDate, toDate,
    } = dto;
    const qb = this.withdrawalRepo
      .createQueryBuilder('wr')
      .leftJoinAndSelect('wr.user', 'u')
      .select([
        'wr.id',
        'wr.amount',
        'wr.payoutMethod',
        'wr.status',
        'wr.createdAt',
        'wr.processedAt',
        'wr.failureReason',
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

    if (fromDate) qb.andWhere('wr.createdAt >= :fromDate', { fromDate: new Date(fromDate) });
    if (toDate) qb.andWhere('wr.createdAt <= :toDate', { toDate: new Date(toDate) });

    const sortColumn = sortBy === 'amount' ? 'wr.amount' : sortBy === 'processedAt' ? 'wr.processedAt' : 'wr.createdAt';
    qb.orderBy(sortColumn, sortOrder);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((wr) => ({
        ...wr,
        user: wr.user ? { id: wr.user.id, name: wr.user.name, mobileNumber: wr.user.mobileNumber, state: wr.user.state } : null,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async processWithdrawal(adminId: string, withdrawalId: string, dto: ProcessWithdrawalDto) {
    const withdrawal = await this.withdrawalRepo.findOne({
      where: { id: withdrawalId },
      relations: ['user', 'wallet'],
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal request not found');
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException('Withdrawal is not in pending state');
    }

    if (dto.action === 'approve') {
      await this.withdrawalRepo.update(withdrawalId, {
        status: WithdrawalStatus.PROCESSING,
        processedAt: new Date(),
      });
      await this.transactionRepo.update(
        { referenceId: withdrawalId },
        { status: TransactionStatus.COMPLETED },
      );
      await this.logAudit({
        actorType: ActorType.ADMIN,
        actorId: adminId,
        action: 'withdrawal_approved',
        entityType: 'withdrawal_request',
        entityId: withdrawalId,
        newValue: { status: WithdrawalStatus.PROCESSING },
      });
      return { success: true, action: 'approved', withdrawalId, status: WithdrawalStatus.PROCESSING };
    } else {
      // Refund wallet balance
      await this.walletRepo.increment({ id: withdrawal.walletId }, 'balance', Number(withdrawal.amount));
      await this.withdrawalRepo.update(withdrawalId, {
        status: WithdrawalStatus.FAILED,
        processedAt: new Date(),
        failureReason: dto.failureReason ?? 'Rejected by admin',
      });
      // Mark the original debit transaction as reversed so user sees correct status in history
      await this.transactionRepo.update(
        { referenceId: withdrawalId },
        { status: TransactionStatus.REVERSED },
      );
      await this.logAudit({
        actorType: ActorType.ADMIN,
        actorId: adminId,
        action: 'withdrawal_rejected',
        entityType: 'withdrawal_request',
        entityId: withdrawalId,
        oldValue: { status: WithdrawalStatus.PENDING },
        newValue: { status: WithdrawalStatus.FAILED, reason: dto.failureReason },
      });
      return { success: true, action: 'rejected', withdrawalId, status: WithdrawalStatus.FAILED };
    }
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
  // Section 7: Data Export
  // ─────────────────────────────────────────────────────────────

  async exportData(dto: ExportQueryDto) {
    const { fromDate, toDate, state, cropType, dataType = 'questions', format = 'csv' } = dto;
    const from = fromDate ? new Date(fromDate) : new Date(0);
    const to = toDate ? new Date(toDate) : new Date();

    if (dataType === 'questions') {
      return this.exportQuestions(from, to, state, cropType, format);
    }
    if (dataType === 'users') {
      return this.exportUsers(from, to, state, format);
    }
    if (dataType === 'rewards') {
      return this.exportRewards(from, to, state, format);
    }
    if (dataType === 'withdrawals') {
      return this.exportWithdrawals(from, to, state, format);
    }
    throw new BadRequestException('Invalid data type');
  }

  private async exportQuestions(from: Date, to: Date, state?: string, cropType?: string, format = 'csv') {
    const qb = this.questionRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.user', 'u')
      .select([
        'q.id',
        'u.mobileNumber',
        'u.name',
        'q.questionText',
        'q.language',
        'q.domainCategory',
        'q.cropType',
        'q.season',
        'q.state',
        'q.district',
        'q.mediaType',
        'q.status',
        'q.aiConfidenceScore',
        'q.submittedAt',
        'q.reviewedAt',
        'q.rejectionReason',
      ])
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .orderBy('q.submittedAt', 'DESC');

    if (state) qb.andWhere('q.state = :state', { state });
    if (cropType) qb.andWhere('q.cropType = :cropType', { cropType });

    const rows = await qb.getMany();

    if (format === 'csv') {
      return { format: 'csv', data: this.toCSV(rows as unknown as Record<string, unknown>[], [
        'id', 'mobileNumber', 'name', 'questionText', 'language',
        'domainCategory', 'cropType', 'season', 'state', 'district',
        'mediaType', 'status', 'aiConfidenceScore', 'submittedAt', 'reviewedAt', 'rejectionReason',
      ])};
    }
    return { format: 'excel', data: rows };
  }

  private async exportUsers(from: Date, to: Date, state?: string, format = 'csv') {
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
      .where('u.createdAt BETWEEN :from AND :to', { from, to })
      .orderBy('u.createdAt', 'DESC');

    if (state) qb.andWhere('u.state = :state', { state });

    const rows = await qb.getMany();

    if (format === 'csv') {
      return { format: 'csv', data: this.toCSV(rows as unknown as Record<string, unknown>[], [
        'id', 'mobileNumber', 'name', 'category', 'state', 'district',
        'verificationStatus', 'role', 'createdAt', 'lastLoginAt',
      ])};
    }
    return { format: 'excel', data: rows };
  }

  private async exportRewards(from: Date, to: Date, state?: string, format = 'csv') {
    const qb = this.transactionRepo
      .createQueryBuilder('tx')
      .innerJoin('tx.wallet', 'w')
      .innerJoin('w.user', 'u')
      .select([
        'tx.id',
        'u.mobileNumber',
        'u.name',
        'tx.amount',
        'tx.type',
        'tx.source',
        'tx.description',
        'tx.status',
        'tx.referenceId',
        'tx.createdAt',
      ])
      .where('tx.source = :source', { source: TransactionSource.REWARD })
      .andWhere('tx.createdAt BETWEEN :from AND :to', { from, to })
      .orderBy('tx.createdAt', 'DESC');

    if (state) qb.andWhere('u.state = :state', { state });

    const rows = await qb.getMany();

    if (format === 'csv') {
      return { format: 'csv', data: this.toCSV(rows as unknown as Record<string, unknown>[], [
        'id', 'mobileNumber', 'name', 'amount', 'type', 'source', 'description', 'status', 'referenceId', 'createdAt',
      ])};
    }
    return { format: 'excel', data: rows };
  }

  private async exportWithdrawals(from: Date, to: Date, state?: string, format = 'csv') {
    const qb = this.withdrawalRepo
      .createQueryBuilder('wr')
      .leftJoin('wr.user', 'u')
      .select([
        'wr.id',
        'u.mobileNumber',
        'u.name',
        'wr.amount',
        'wr.payoutMethod',
        'wr.status',
        'wr.createdAt',
        'wr.processedAt',
        'wr.failureReason',
      ])
      .where('wr.createdAt BETWEEN :from AND :to', { from, to })
      .orderBy('wr.createdAt', 'DESC');

    if (state) qb.andWhere('u.state = :state', { state });

    const rows = await qb.getMany();

    if (format === 'csv') {
      return { format: 'csv', data: this.toCSV(rows as unknown as Record<string, unknown>[], [
        'id', 'mobileNumber', 'name', 'amount', 'payoutMethod', 'status', 'createdAt', 'processedAt', 'failureReason',
      ])};
    }
    return { format: 'excel', data: rows };
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

    // Average AI confidence
    const avgConfidence = await this.questionRepo
      .createQueryBuilder('q')
      .select('AVG(q.aiConfidenceScore)', 'avg')
      .where('q.submittedAt BETWEEN :from AND :to', { from, to })
      .andWhere('q.aiConfidenceScore IS NOT NULL')
      .getRawOne<{ avg: string | null }>();

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
      avgAiConfidence: avgConfidence?.avg ? parseFloat(Number(avgConfidence.avg).toFixed(2)) : null,
      avgReviewTurnaroundMinutes: avgTurnaroundMinutes || null,
    };
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
        'wr.failureReason',
        'wr.processedAt',
        'wr.createdAt',
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
    if (!isSuperAdmin) throw new ForbiddenException('Only super admins can manually adjust wallet balances');

    const wallet = await this.walletRepo.findOne({ where: { userId: dto.userId } });
    if (!wallet) throw new NotFoundException('Wallet not found for this user');

    const amount = Number(dto.amount);
    if (amount === 0) throw new BadRequestException('Adjustment amount cannot be zero');

    if (amount > 0) {
      await this.walletRepo.increment({ id: wallet.id }, 'balance', amount);
      await this.transactionRepo.save({
        walletId: wallet.id,
        amount,
        type: TransactionType.CREDIT,
        source: TransactionSource.ADJUSTMENT,
        status: TransactionStatus.COMPLETED,
        description: dto.description ?? `Manual adjustment: ${dto.reason}`,
        balanceAfter: Number(wallet.balance) + amount,
      });
    } else {
      const debit = Math.abs(amount);
      if (Number(wallet.balance) < debit) {
        throw new BadRequestException('Insufficient balance for this debit adjustment');
      }
      await this.walletRepo.decrement({ id: wallet.id }, 'balance', debit);
      await this.transactionRepo.save({
        walletId: wallet.id,
        amount: debit,
        type: TransactionType.DEBIT,
        source: TransactionSource.ADJUSTMENT,
        status: TransactionStatus.COMPLETED,
        description: dto.description ?? `Manual adjustment: ${dto.reason}`,
        balanceAfter: Number(wallet.balance) - debit,
      });
    }

    const updatedWallet = await this.walletRepo.findOne({ where: { id: wallet.id } });

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: 'wallet_balance_adjusted',
      entityType: 'wallet',
      entityId: wallet.id,
      oldValue: { balance: Number(wallet.balance) },
      newValue: { balance: Number(updatedWallet!.balance) },
      metadata: { reason: dto.reason, adjustmentAmount: amount },
    });

    return {
      success: true,
      userId: dto.userId,
      walletId: wallet.id,
      previousBalance: Number(wallet.balance),
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
}