import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
  AuditAction,
  ActorType,
  TransactionSource,
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
} from './dto';
import { ConfigService } from '@nestjs/config';

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
};

@Injectable()
export class AdminService {
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
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Section 1: User Management
  // ─────────────────────────────────────────────────────────────

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

    const sortCol = sortBy === 'verificationStatus' ? 'u.verificationStatus' : sortBy === 'state' ? 'u.state' : sortBy === 'name' ? 'u.name' : 'u.createdAt';
    qb.orderBy(sortCol, sortOrder);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getUserDetail(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['wallet'],
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

  async suspendOrBanUser(adminId: string, userId: string, action: 'suspend' | 'ban', reason?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isSuperAdmin = await this.isSuperAdmin(adminId);
    if (!isSuperAdmin) throw new ForbiddenException('Only super admins can suspend or ban users');

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot suspend or ban a super admin');
    }

    const newStatus = action === 'ban' ? VerificationStatus.BANNED : VerificationStatus.SUSPENDED;
    const oldStatus = user.verificationStatus;

    await this.userRepo.update(userId, { verificationStatus: newStatus });

    await this.logAudit({
      actorType: ActorType.ADMIN,
      actorId: adminId,
      action: action === 'ban' ? AuditAction.USER_BANNED : AuditAction.USER_SUSPENDED,
      entityType: 'user',
      entityId: userId,
      oldValue: { verificationStatus: oldStatus },
      newValue: { verificationStatus: newStatus, reason },
    });

    return { success: true, userId, newStatus };
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
      .select([
        'q.id',
        'q.userId',
        'q.questionText',
        'q.mediaType',
        'q.mediaUrls',
        'q.status',
        'q.aiConfidenceScore',
        'q.submittedAt',
        'q.language',
        'q.domainCategory',
        'q.cropType',
        'q.state',
      ])
      .skip((page - 1) * limit)
      .take(limit);

    // Status filter
    if (status) {
      qb.andWhere('q.status = :status', { status });
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
    const sortColumn = sortBy === 'aiConfidenceScore' ? 'q.aiConfidenceScore' : sortBy === 'state' ? 'q.state' : 'q.submittedAt';
    qb.orderBy(sortColumn, sortOrder);

    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((q) => ({
        ...q,
        user: q.user ? { id: q.user.id, name: q.user.name, mobileNumber: q.user.mobileNumber } : null,
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
      relations: ['user'],
    });
    if (!question) throw new NotFoundException('Question not found');
    return {
      ...question,
      user: question.user
        ? { id: question.user.id, name: question.user.name, mobileNumber: question.user.mobileNumber, state: question.user.state }
        : null,
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

    if (!['human_review', 'ai_review'].includes(question.status)) {
      throw new BadRequestException('Question is not in a reviewable state');
    }

    const actorType: ActorType =
      reviewerRole === UserRole.CURATOR ? ActorType.CURATOR : ActorType.ADMIN;
    const oldStatus = question.status;

    if (dto.action === 'approve') {
      await this.questionRepo.update(questionId, {
        status: QuestionStatus.APPROVED,
        reviewerId: reviewerId,
        reviewedAt: new Date(),
      });
      await this.logAudit({
        actorType,
        actorId: reviewerId,
        action: AuditAction.QUESTION_APPROVED,
        entityType: 'question',
        entityId: questionId,
        oldValue: { status: oldStatus },
        newValue: { status: QuestionStatus.APPROVED },
      });
      return { success: true, action: 'approved', questionId };
    }

    if (dto.action === 'reject') {
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
      return { success: true, action: 'rejected', questionId };
    }

    // request_info — move to human_review
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

    await this.configRepo.update(dto.key, {
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

    return { success: true, config: { key: saved.key, value: saved.value, description: saved.description } };
  }

  // Get a single config value (with fallback to default)
  async getConfigValue(key: string): Promise<number> {
    const config = await this.configRepo.findOne({ where: { key } });
    if (config) return config.value as number;
    return DEFAULT_CONFIG[key]?.value ?? 0;
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
  // Section 9: Helpers
  // ─────────────────────────────────────────────────────────────

  private async isSuperAdmin(adminId: string): Promise<boolean> {
    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    return admin?.role === UserRole.SUPER_ADMIN;
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