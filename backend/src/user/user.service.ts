import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, AuditLog, Notification, Question, Transaction } from '../database/entities';
import { AuditAction, ActorType, QuestionStatus, TransactionType, TransactionSource, TransactionStatus, UserRole } from '../common/enums';
import { UpdateProfileDto, UpdateCropDetailsDto } from './dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    actorType: ActorType = ActorType.USER,
    actorId?: string,
  ): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    const PROFILE_DATA_KEYS = [
      'farmSize', 'cropType', 'courseName',
      'universityName', 'organisationName', 'memberRole',
    ];

    const userRecord = user as unknown as Record<string, unknown>;
    for (const [key, newVal] of Object.entries(dto)) {
      if (newVal === undefined) continue;

      if (key === 'crops') {
        // Crops are stored directly on the user record as text[]
        oldValue[key] = userRecord[key];
        userRecord[key] = newVal;
        newValue[key] = newVal;
      } else if (PROFILE_DATA_KEYS.includes(key)) {
        // Store category-specific fields inside profileData JSONB
        const existing = (userRecord['profileData'] as Record<string, unknown>) ?? {};
        oldValue[key] = existing[key];
        userRecord['profileData'] = { ...existing, [key]: newVal };
        newValue[key] = newVal;
      } else {
        oldValue[key] = userRecord[key];
        userRecord[key] = newVal;
        newValue[key] = newVal;
      }
    }

    const savedUser = await this.userRepo.save(user);

    await this.logAudit(
      actorType,
      actorId ?? userId,
      AuditAction.USER_PROFILE_UPDATED,
      'User',
      userId,
      oldValue,
      newValue,
    );

    return savedUser;
  }

  /**
   * Replace the user's crop list. Thin wrapper around updateProfile.
   * Kept for backwards-compatible /me/crops endpoint.
   */
  async updateCropDetails(userId: string, dto: UpdateCropDetailsDto): Promise<string[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.crops = dto.crops ?? [];
    await this.userRepo.save(user);
    return user.crops;
  }

  // ─── Notifications ───────────────────────────────────────────────────────

  async getNotifications(
    userId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ notifications: Notification[]; unread: number; total: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(50, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      this.notifRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      }),
      this.notifRepo.count({ where: { userId } }),
      this.notifRepo.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unread: unreadCount,
      total,
    };
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────────

  async getLeaderboard(
    userId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{
    entries: Array<{
      rank: number;
      userId: string;
      name: string;
      totalEarned: number;
      totalQuestions: number;
      medal: 'gold' | 'silver' | 'bronze' | null;
      isCurrentUser: boolean;
    }>;
    userRank: number | null;
    total: number;
  }> {
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = Math.max(0, options.offset ?? 0);

    // Build the earned subquery as a plain SQL string with hardcoded enum values
    // so it can be safely embedded in the outer LEFT JOIN without param conflicts.
    const earnedSubSql = `
      SELECT w.user_id AS "userId", SUM(tx.amount)::float AS "totalEarned"
      FROM transactions tx
      JOIN wallets w ON w.id = tx.wallet_id
      JOIN users u ON u.id = w.user_id AND u.role = '${UserRole.USER}'
      WHERE tx.type = '${TransactionType.CREDIT}'
        AND tx.source = '${TransactionSource.REWARD}'
        AND tx.status = '${TransactionStatus.COMPLETED}'
      GROUP BY w.user_id
    `;

    // Build the approved-questions subquery as a plain SQL string as well
    const questionsSubSql = `
      SELECT user_id AS "userId", COUNT(*)::int AS "totalQuestions"
      FROM questions q
      JOIN users u ON u.id = q.user_id AND u.role = '${UserRole.USER}'
      WHERE q.status = '${QuestionStatus.APPROVED}'
      GROUP BY q.user_id
    `;

    // Main query: join users with both aggregate subqueries — farmer users only
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoin(`(${earnedSubSql.trim()})`, 'e', 'e."userId" = u.id')
      .leftJoin(`(${questionsSubSql.trim()})`, 'qc', 'qc."userId" = u.id')
      .select([
        'u.id AS "userId"',
        'u.name AS name',
        'COALESCE(e."totalEarned", 0) AS "totalEarned"',
        'COALESCE(qc."totalQuestions", 0) AS "totalQuestions"',
      ])
      .where('u.role = :userRole', { userRole: UserRole.USER })
      .andWhere('COALESCE(qc."totalQuestions", 0) > 0')
      .orderBy('"totalQuestions"', 'DESC')
      .addOrderBy('"totalEarned"', 'DESC');

    const allRows: Array<{
      userId: string;
      name: string;
      totalEarned: number;
      totalQuestions: number;
    }> = await qb.getRawMany();

    const total = allRows.length;

    // Assign sequential unique ranks (1, 2, 3 …) — each user gets a distinct number
    const ranked = allRows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));

    // Find requesting user's rank
    const userRankEntry = ranked.find((r) => r.userId === userId);
    const userRank = userRankEntry?.rank ?? null;

    // Build medal map
    const medalMap: Record<number, 'gold' | 'silver' | 'bronze' | null> = {};
    for (const entry of ranked) {
      if (entry.rank === 1) medalMap[entry.rank] = 'gold';
      else if (entry.rank === 2) medalMap[entry.rank] = 'silver';
      else if (entry.rank === 3) medalMap[entry.rank] = 'bronze';
      else medalMap[entry.rank] = null;
    }

    // Paginate slice
    const slice = ranked.slice(offset, offset + limit);

    const entries = slice.map((row) => ({
      rank: row.rank,
      userId: row.userId,
      name: row.name,
      totalEarned: row.totalEarned,
      totalQuestions: row.totalQuestions,
      medal: medalMap[row.rank] ?? null,
      isCurrentUser: row.userId === userId,
    }));

    return { entries, userRank, total };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.notifRepo.update({ id: notificationId, userId }, { isRead: true });
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
  }

  async createNotification(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<Notification> {
    const notif = this.notifRepo.create({
      userId: params.userId,
      type: params.type as any,
      title: params.title,
      body: params.body,
      data: params.data ?? null,
    });
    return this.notifRepo.save(notif);
  }

  private async logAudit(
    actorType: ActorType,
    actorId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    oldValue?: Record<string, unknown> | null,
    newValue?: Record<string, unknown> | null,
  ): Promise<void> {
    const log = this.auditRepo.create({
      actorType,
      actorId,
      action,
      entityType,
      entityId,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    });
    await this.auditRepo.save(log);
  }
}