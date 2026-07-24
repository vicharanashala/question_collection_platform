import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Repository as TypeOrmRepo } from 'typeorm';
import {
  Report,
  ReportReply,
  Notification,
  AuditLog,
  User,
} from '../database/entities';
import {
  CreateReportDto,
  ReplyReportDto,
  ListReportsDto,
} from './dto';
import {
  ActorType,
  AuditAction,
  ReportStatus,
  ReportPriority,
  UserRole,
} from '../common/enums';
import {
  NotificationType,
  NotificationTriggerType,
} from '../database/entities/notification.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(ReportReply)
    private readonly replyRepo: Repository<ReportReply>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async logAudit(
    actorId: string,
    actorRole: UserRole,
    action: AuditAction,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    let actorType: ActorType
    if (actorRole === UserRole.FINANCE) {
      actorType = ActorType.FINANCE
    } else if (actorRole === UserRole.CURATOR) {
      actorType = ActorType.CURATOR
    } else {
      actorType = ActorType.ADMIN
    }

    await this.auditRepo.save({
      actorType,
      actorId,
      action,
      entityType,
      entityId,
      metadata,
    } as Parameters<typeof this.auditRepo.save>[0]);
  }

  // ─── User-facing ──────────────────────────────────────────────────────────

  /**
   * Any authenticated user submits a new report.
   */
  async createReport(
    userId: string,
    dto: CreateReportDto,
  ): Promise<Report> {
    const report = this.reportRepo.create({
      userId,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      relatedEntityId: dto.relatedEntityId ?? null,
      relatedEntityType: dto.relatedEntityType ?? null,
    });

    const saved = await this.reportRepo.save(report);

    await this.logAudit(
      userId,
      UserRole.USER,
      AuditAction.REPORT_SUBMITTED,
      'report',
      saved.id,
      { category: dto.category },
    );

    return saved;
  }

  /**
   * User fetches their own single report with replies.
   */
  async getMyReport(userId: string, reportId: string): Promise<Report | null> {
    return this.reportRepo.findOne({
      where: { id: reportId, userId },
      relations: ['replies'],
    });
  }

  /**
   * User fetches their own reports (paginated).
   */
  async getMyReports(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [items, total] = await this.reportRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
      relations: ['replies'],
    });

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── Admin-facing ─────────────────────────────────────────────────────────

  /**
   * List all reports with optional filters (admin/curator).
   */
  async listReports(dto: ListReportsDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const qb = this.reportRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'user')
      .leftJoinAndSelect('r.replies', 'replies')
      .leftJoinAndSelect('replies.admin', 'admin')
      .select([
        'r.id',
        'r.title',
        'r.category',
        'r.status',
        'r.priority',
        'r.createdAt',
        'user.id',
        'user.name',
        'user.mobileNumber',
        'replies.id',
        'replies.message',
        'replies.createdAt',
        'admin.id',
        'admin.name',
      ]);

    if (dto.status) {
      qb.andWhere('r.status = :status', { status: dto.status });
    }
    if (dto.category) {
      qb.andWhere('r.category = :category', { category: dto.category });
    }
    if (dto.priority) {
      qb.andWhere('r.priority = :priority', { priority: dto.priority });
    }

    qb.orderBy('r.createdAt', 'DESC').skip(offset).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single report with its reply thread.
   */
  async getReport(reportId: string) {
    return this.reportRepo.findOne({
      where: { id: reportId },
      relations: ['user', 'replies', 'replies.admin'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Update report status.
   */
  async updateStatus(
    reportId: string,
    status: ReportStatus,
    actorId: string,
    actorRole: UserRole,
  ): Promise<Report> {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new Error('Report not found');

    const oldStatus = report.status;
    report.status = status;
    const saved = await this.reportRepo.save(report);

    await this.logAudit(
      actorId,
      actorRole,
      AuditAction.REPORT_STATUS_CHANGED,
      'report',
      reportId,
      { oldStatus, newStatus: status },
    );

    // Notify user when report is closed
    if (status === ReportStatus.CLOSED) {
      await this.sendReportClosedNotification(report, report.title);
    }

    return saved;
  }

  /**
   * Notify the reporter that their report has been closed.
   */
  private async sendReportClosedNotification(
    report: Report,
    reportTitle: string,
  ): Promise<void> {
    const title = 'Your report has been closed';
    const body =
      reportTitle.length > 80
        ? reportTitle.slice(0, 77) + '...'
        : reportTitle;

    const notification = this.notificationRepo.create({
      userId: report.userId,
      type: NotificationType.REPORT_CLOSED,
      triggerType: NotificationTriggerType.REPORT,
      title,
      body,
      data: { reportId: report.id },
    });
    await this.notificationRepo.save(notification);

    const user = await this.userRepo.findOne({
      where: { id: report.userId },
      select: ['expoPushToken'],
    });
    if (user?.expoPushToken) {
      try {
        const axios = (await import('axios')).default;
        await axios.post(
          'https://exp.host/--/api/v2/push/send',
          { title, body, data: { reportId: report.id }, to: user.expoPushToken },
          { headers: { 'Content-Type': 'application/json' }, timeout: 8_000 },
        );
      } catch {
        // Silently ignore push failures; in-app notification is already persisted.
      }
    }
  }

  /**
   * Update report priority.
   */
  async updatePriority(
    reportId: string,
    priority: ReportPriority,
    actorId: string,
    actorRole: UserRole,
  ): Promise<Report> {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new Error('Report not found');

    const oldPriority = report.priority;
    report.priority = priority;
    const saved = await this.reportRepo.save(report);

    await this.logAudit(
      actorId,
      actorRole,
      AuditAction.REPORT_STATUS_CHANGED, // reuse — no REPORT_PRIORITY_CHANGED in the enum
      'report',
      reportId,
      { oldPriority, newPriority: priority },
    );

    return saved;
  }

  /**
   * Add an admin reply to a report.
   * - Persists the reply
   * - Notifies the original reporter (in-app + Expo push)
   * - Updates report status to in_progress if it was 'open'
   */
  async addReply(
    reportId: string,
    adminId: string,
    adminRole: UserRole,
    dto: ReplyReportDto,
  ): Promise<ReportReply> {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new Error('Report not found');

    // Persist the reply
    const reply = this.replyRepo.create({
      reportId,
      adminId,
      message: dto.message,
    });
    const savedReply = await this.replyRepo.save(reply);

    // Update status to in_progress if open
    if (report.status === ReportStatus.OPEN) {
      report.status = ReportStatus.IN_PROGRESS;
      await this.reportRepo.save(report);
    }

    // Send notification to the reporter
    const body =
      dto.message.length > 100
        ? dto.message.slice(0, 97) + '...'
        : dto.message;

    const notification = this.notificationRepo.create({
      userId: report.userId,
      type: NotificationType.REPORT_REPLY,
      triggerType: NotificationTriggerType.REPORT,
      title: 'Your report has been replied to',
      body,
      data: { reportId, replyId: savedReply.id },
    });
    await this.notificationRepo.save(notification);

    // Send Expo push notification
    await this.sendPushNotification(report.userId, {
      title: 'Your report has been replied to',
      body,
      data: { reportId, replyId: savedReply.id },
    });

    await this.logAudit(
      adminId,
      adminRole,
      AuditAction.REPORT_REPLIED,
      'report',
      reportId,
      { replyId: savedReply.id },
    );

    return savedReply;
  }

  private async sendPushNotification(
    userId: string,
    payload: { title: string; body: string; data: Record<string, unknown> },
  ): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['expoPushToken'],
    });
    if (!user?.expoPushToken) return;

    try {
      const axios = (await import('axios')).default;
      await axios.post(
        'https://exp.host/--/api/v2/push/send',
        { ...payload, to: user.expoPushToken },
        { headers: { 'Content-Type': 'application/json' }, timeout: 8_000 },
      );
    } catch {
      // Silently ignore push failures; in-app notification is already persisted.
    }
  }
}