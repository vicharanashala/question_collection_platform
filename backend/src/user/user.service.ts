import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, UserCropDetail, AuditLog, Notification } from '../database/entities';
import { AuditAction, ActorType } from '../common/enums';
import { UpdateProfileDto, UpdateCropDetailsDto } from './dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserCropDetail)
    private readonly cropRepo: Repository<UserCropDetail>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
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

      if (PROFILE_DATA_KEYS.includes(key)) {
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

  async updateCropDetails(userId: string, dto: UpdateCropDetailsDto): Promise<UserCropDetail[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Remove existing crop details
      await queryRunner.manager.delete(UserCropDetail, { userId });

      // Insert new ones
      if (dto.crops && dto.crops.length > 0) {
        const cropDetails = dto.crops.map((crop) =>
          queryRunner.manager.create(UserCropDetail, {
            userId,
            cropName: crop.cropName,
            season: crop.season,
          }),
        );
        await queryRunner.manager.save(cropDetails);
      }

      await queryRunner.commitTransaction();

      // Reload and return
      return this.cropRepo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getCropDetails(userId: string): Promise<UserCropDetail[]> {
    return this.cropRepo.find({ where: { userId }, order: { createdAt: 'ASC' } });
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