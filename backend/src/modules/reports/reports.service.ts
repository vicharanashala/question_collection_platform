import { Injectable, Inject } from '@nestjs/common';
import {
  IReportRepository,
  IReportReplyRepository,
  INotificationRepository,
  IAuditLogRepository,
  IUserRepository,
  REPOSITORY_TOKENS,
} from '../../shared/database/repositories';
import { CreateReportDto, ReplyReportDto, ListReportsDto } from './dto';
import {
  ActorType,
  AuditAction,
  ReportStatus,
  ReportPriority,
  UserRole,
} from '../../shared/classes/enums';
import { NotificationType, NotificationTriggerType } from '../../shared/database/entities/notification.entity';
import { Report } from '../../shared/database/entities/report.entity';
import { ReportReply } from '../../shared/database/entities/report-reply.entity';

@Injectable()
export class ReportsService {
  constructor(
    @Inject(REPOSITORY_TOKENS.Report)
    private readonly reportRepo: IReportRepository,
    @Inject(REPOSITORY_TOKENS.ReportReply)
    private readonly replyRepo: IReportReplyRepository,
    @Inject(REPOSITORY_TOKENS.Notification)
    private readonly notificationRepo: INotificationRepository,
    @Inject(REPOSITORY_TOKENS.AuditLog)
    private readonly auditRepo: IAuditLogRepository,
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
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
    let actorType: ActorType;
    if (actorRole === UserRole.FINANCE) {
      actorType = ActorType.FINANCE;
    } else if (actorRole === UserRole.CURATOR) {
      actorType = ActorType.CURATOR;
    } else {
      actorType = ActorType.ADMIN;
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

  async createReport(userId: string, dto: CreateReportDto): Promise<Report> {
    const saved = await this.reportRepo.create({
      userId,
      title: dto.title,
      description: dto.description,
      category: dto.category,
      relatedEntityId: dto.relatedEntityId ?? null,
      relatedEntityType: dto.relatedEntityType ?? null,
    } as never);

    await this.logAudit(
      userId,
      UserRole.USER,
      AuditAction.REPORT_SUBMITTED,
      'report',
      (saved as { id: string }).id,
      { category: dto.category },
    );

    return saved;
  }

  async getMyReport(userId: string, reportId: string): Promise<unknown | null> {
    const qb = this.reportRepo.createQueryBuilder('report')
      .leftJoinAndSelect('report.replies', 'reply')
      .where('report.id = :reportId AND report.userId = :userId', { reportId, userId });
    return qb.getOne();
  }

  async getMyReports(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const { data: items, total } = await this.reportRepo.findAndCount(
      { userId } as never,
      { pagination: { page, limit, sort: { createdAt: -1 } } },
    );
    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ─── Admin-facing ─────────────────────────────────────────────────────────

  async listReports(dto: ListReportsDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    // Build the base filter
    const match: Record<string, unknown> = {};
    if (dto.status) match.status = dto.status;
    if (dto.category) match.category = dto.category;
    if (dto.priority) match.priority = dto.priority;

    // MongoDB aggregation pipeline with $lookup for user
    // NOTE: reports.userId is stored as a string while users._id is ObjectId,
    // so we must $convert to ObjectId before the $lookup.
    const pipeline: Record<string, unknown>[] = [
      { $match: match },
      { $addFields: { userIdOid: { $toObjectId: '$userId' } } },
      {
        $lookup: {
          from: 'users',
          localField: 'userIdOid',
          foreignField: '_id',
          as: 'userArr',
        },
      },
      { $unwind: { path: '$userArr', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          id: { $toString: '$_id' },
          userId: 1,
          title: 1,
          description: 1,
          category: 1,
          status: 1,
          priority: 1,
          relatedEntityId: 1,
          relatedEntityType: 1,
          createdAt: 1,
          updatedAt: 1,
          'user.id': { $toString: '$userArr._id' },
          'user.name': '$userArr.name',
          'user.mobileNumber': '$userArr.mobileNumber',
        },
      },
      { $sort: { createdAt: -1 } as Record<string, 1 | -1> },
      { $skip: offset },
      { $limit: limit },
    ];

    // Run pipeline + count separately
    const [items, total] = await Promise.all([
      (this.reportRepo as unknown as { _model: { aggregate: (p: unknown) => { exec: () => Promise<unknown[]> } } })
        ._model.aggregate(pipeline).exec(),
      this.reportRepo.count(match),
    ]);

    // Normalise _id → id
    const normalised = (items as Record<string, unknown>[]).map((r) => ({
      ...r,
      id: String(r._id),
      _id: undefined,
    }));

    return { items: normalised, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getReport(reportId: string): Promise<unknown | null> {
    const { Types } = require('mongoose');
    const oid = new Types.ObjectId(reportId);

    // NOTE: reports.userId is stored as a string while users._id is ObjectId.
    // report_replies.reportId is an ObjectId (not a string).
    const pipeline: Record<string, unknown>[] = [
      { $match: { _id: oid } },
      { $addFields: { userIdOid: { $toObjectId: '$userId' } } },
      {
        $lookup: {
          from: 'users',
          localField: 'userIdOid',
          foreignField: '_id',
          as: 'userArr',
        },
      },
      { $unwind: { path: '$userArr', preserveNullAndEmptyArrays: true } },
      { $addFields: { idStr: { $toString: '$_id' } } },
      {
        $lookup: {
          from: 'report_replies',
          localField: 'idStr',
          foreignField: 'reportId',
          as: 'repliesArr',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'repliesArr.adminId',
          foreignField: '_id',
          as: 'repliesAdminArr',
        },
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          title: 1,
          description: 1,
          category: 1,
          status: 1,
          priority: 1,
          relatedEntityId: 1,
          relatedEntityType: 1,
          createdAt: 1,
          updatedAt: 1,
          'user.id': { $toString: '$userArr._id' },
          'user.name': '$userArr.name',
          'user.mobileNumber': '$userArr.mobileNumber',
          replies: {
            $map: {
              input: '$repliesArr',
              as: 'r',
              in: {
                id: { $toString: '$$r._id' },
                message: '$$r.message',
                createdAt: '$$r.createdAt',
                admin: {
                  $let: {
                    vars: {
                      adminMatch: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$repliesAdminArr',
                              cond: { $eq: [{ $toString: '$$this._id' }, '$$r.adminId'] },
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: {
                      id: { $toString: '$$adminMatch._id' },
                      name: '$$adminMatch.name',
                    },
                  },
                },
              },
            },
          },
        },
      },
      { $sort: { createdAt: 1 } as Record<string, 1 | -1> },
    ];

    const results = await (this.reportRepo as unknown as { _model: { aggregate: (p: unknown) => { exec: () => Promise<unknown[]> } } })
      ._model.aggregate(pipeline).exec();

    if (!results.length) return null;

    const r = results[0] as Record<string, unknown>;
    // id is already in the projection; clean up _id
    const { _id, ...rest } = r;
    return { ...rest, id: String(_id) };
  }

  async updateStatus(
    reportId: string,
    status: ReportStatus,
    actorId: string,
    actorRole: UserRole,
  ): Promise<Report> {
    const report = await this.reportRepo.findOne({ id: reportId } as never);
    if (!report) throw new Error('Report not found');
    const oldStatus = (report as { status: ReportStatus }).status;
    (report as { status: ReportStatus }).status = status;
    const saved = await this.reportRepo.save(report);

    await this.logAudit(
      actorId,
      actorRole,
      AuditAction.REPORT_STATUS_CHANGED,
      'report',
      reportId,
      { oldStatus, newStatus: status },
    );

    if (status === ReportStatus.CLOSED) {
      await this.sendReportClosedNotification(saved as never, (saved as { title: string }).title);
    }

    return saved;
  }

  private async sendReportClosedNotification(
    report: unknown,
    reportTitle: string,
  ): Promise<void> {
    const title = 'Your report has been closed';
    const body = reportTitle.length > 80 ? reportTitle.slice(0, 77) + '...' : reportTitle;
    const reportId = (report as { id: string }).id;
    const userId = (report as { userId: string }).userId;

    await this.notificationRepo.create({
      userId,
      type: NotificationType.REPORT_CLOSED,
      triggerType: NotificationTriggerType.REPORT,
      title,
      body,
      data: { reportId },
    } as never);

    await this.sendPushNotification(userId, { title, body, data: { reportId } });
  }

  async updatePriority(
    reportId: string,
    priority: ReportPriority,
    actorId: string,
    actorRole: UserRole,
  ): Promise<Report> {
    const report = await this.reportRepo.findOne({ id: reportId } as never);
    if (!report) throw new Error('Report not found');
    const oldPriority = (report as { priority: ReportPriority }).priority;
    (report as { priority: ReportPriority }).priority = priority;
    const saved = await this.reportRepo.save(report);

    await this.logAudit(
      actorId,
      actorRole,
      AuditAction.REPORT_STATUS_CHANGED,
      'report',
      reportId,
      { oldPriority, newPriority: priority },
    );

    return saved;
  }

  async addReply(
    reportId: string,
    adminId: string,
    adminRole: UserRole,
    dto: ReplyReportDto,
  ): Promise<ReportReply> {
    const report = await this.reportRepo.findOne({ id: reportId } as never);
    if (!report) throw new Error('Report not found');

    const savedReply = await this.replyRepo.create({
      reportId,
      adminId,
      message: dto.message,
    } as never);

    if ((report as { status: ReportStatus }).status === ReportStatus.OPEN) {
      (report as { status: ReportStatus }).status = ReportStatus.IN_PROGRESS;
      await this.reportRepo.save(report);
    }

    const body = dto.message.length > 100 ? dto.message.slice(0, 97) + '...' : dto.message;
    const userId = (report as { userId: string }).userId;

    await this.notificationRepo.create({
      userId,
      type: NotificationType.REPORT_REPLY,
      triggerType: NotificationTriggerType.REPORT,
      title: 'Your report has been replied to',
      body,
      data: { reportId, replyId: (savedReply as { id: string }).id },
    } as never);

    await this.sendPushNotification(userId, {
      title: 'Your report has been replied to',
      body,
      data: { reportId, replyId: (savedReply as { id: string }).id },
    });

    await this.logAudit(
      adminId,
      adminRole,
      AuditAction.REPORT_REPLIED,
      'report',
      reportId,
      { replyId: (savedReply as { id: string }).id },
    );

    return savedReply;
  }

  private async sendPushNotification(
    userId: string,
    payload: { title: string; body: string; data: Record<string, unknown> },
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) return;
    const expoPushToken = (user as unknown as { expoPushToken?: string }).expoPushToken;
    if (!expoPushToken) return;

    try {
      const axios = (await import('axios')).default;
      await axios.post(
        'https://exp.host/--/api/v2/push/send',
        { ...payload, to: expoPushToken },
        { headers: { 'Content-Type': 'application/json' }, timeout: 8_000 },
      );
    } catch {
      // Silently ignore.
    }
  }
}