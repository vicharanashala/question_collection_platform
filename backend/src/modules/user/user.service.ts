import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import {
  User,
  AuditLog,
  Notification,
  Question,
  Transaction,
} from "../../shared/database/entities";
import {
  AuditAction,
  ActorType,
  QuestionStatus,
  TransactionType,
  TransactionSource,
  TransactionStatus,
  UserRole,
} from "../../shared/classes/enums";
import { UpdateProfileDto, UpdateCropDetailsDto } from "./dto";
import {
  IUserRepository,
  IAuditLogRepository,
  INotificationRepository,
  IQuestionRepository,
  ITransactionRepository,
} from "../../shared/database/repositories";
import { REPOSITORY_TOKENS } from "../../shared/database/repositories";

@Injectable()
export class UserService {
  constructor(
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    @Inject(REPOSITORY_TOKENS.AuditLog)
    private readonly auditRepo: IAuditLogRepository,
    @Inject(REPOSITORY_TOKENS.Notification)
    private readonly notifRepo: INotificationRepository,
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
    @Inject(REPOSITORY_TOKENS.Transaction)
    private readonly transactionRepo: ITransactionRepository,
  ) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
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
      throw new NotFoundException("User not found");
    }

    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    // All DTO fields are now top-level columns — assign directly
    const userRecord = user as unknown as Record<string, unknown>;
    for (const [key, newVal] of Object.entries(dto)) {
      if (newVal === undefined) continue;
      oldValue[key] = userRecord[key];
      userRecord[key] = newVal;
      newValue[key] = newVal;
    }

    const savedUser = await this.userRepo.save(user);

    await this.logAudit(
      actorType,
      actorId ?? userId,
      AuditAction.USER_PROFILE_UPDATED,
      "User",
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
  async updateCropDetails(
    userId: string,
    dto: UpdateCropDetailsDto,
  ): Promise<string[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
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
      this.notifRepo.findAll(
        { userId },
        { pagination: { page, limit, sort: { createdAt: -1 } } },
      ),
      this.notifRepo.count({ userId }),
      this.notifRepo.count({ userId, isRead: false }),
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
      medal: string | null;
      isCurrentUser: boolean;
    }>;
    userRank: number | null;
    total: number;
  }> {
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));

    const offset = Math.max(0, options.offset ?? 0);

    // Get ONLY the requested page from MongoDB
    const { entries: rows, total } = await this.userRepo.getLeaderboard({
      limit,
      offset,
    });

    // Assign the GLOBAL rank, not page-relative rank
    const ranked = rows.map((row, index) => ({
      ...row,
      rank: offset + index + 1,
    }));

    // TODO: calculate this properly in Step 3
    const userRank = await this.userRepo.getLeaderboardRank({
      userId,
    });

    const entries = ranked.map((row) => ({
      rank: row.rank,
      userId: row.id,
      name: row.name,
      totalEarned: row.totalEarned,
      totalQuestions: row.totalQuestions,
      medal:
        row.rank === 1
          ? "gold"
          : row.rank === 2
            ? "silver"
            : row.rank === 3
              ? "bronze"
              : null,
      isCurrentUser: row.id === userId,
    }));

    return {
      entries,
      userRank,
      total,
    };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.notifRepo.update(notificationId, { isRead: true });
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.notifRepo.updateMany(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async createNotification(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<Notification> {
    return this.notifRepo.create({
      userId: params.userId,
      type: params.type as any,
      title: params.title,
      body: params.body,
      data: params.data ?? null,
    });
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
    const log = await this.auditRepo.create({
      actorType,
      actorId,
      action,
      entityType,
      entityId,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    });
  }
}
