import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuditLog } from '../database/entities';
import { AuditAction } from '../common/enums';
import { QueryAuditLogsDto, AuditStatsDto } from './dto';

type ActionCategory = 'withdrawal' | 'user' | 'question' | 'config' | 'auth';

const ACTION_CATEGORY: Record<string, ActionCategory> = {
  [AuditAction.OTP_REQUESTED]: 'auth',
  [AuditAction.OTP_VERIFIED]: 'auth',
  [AuditAction.OTP_EXPIRED]: 'auth',
  [AuditAction.USER_REGISTERED]: 'user',
  [AuditAction.USER_PROFILE_UPDATED]: 'user',
  [AuditAction.USER_SUSPENDED]: 'user',
  [AuditAction.USER_BANNED]: 'user',
  [AuditAction.USER_UNSUSPENDED]: 'user',
  [AuditAction.USER_UNBANNED]: 'user',
  [AuditAction.USER_VERIFIED]: 'user',
  [AuditAction.QUESTION_SUBMITTED]: 'question',
  [AuditAction.QUESTION_APPROVED]: 'question',
  [AuditAction.QUESTION_REJECTED]: 'question',
  [AuditAction.REWARD_CREDITED]: 'withdrawal',
  [AuditAction.WITHDRAWAL_REQUESTED]: 'withdrawal',
  [AuditAction.WITHDRAWAL_COMPLETED]: 'withdrawal',
  [AuditAction.ADMIN_CONFIG_UPDATED]: 'config',
};

const WITHDRAWAL_ACTIONS = new Set([
  AuditAction.WITHDRAWAL_COMPLETED,
  'withdrawal_approved',
  'withdrawal_rejected',
  'withdrawal_retry',
  AuditAction.WITHDRAWAL_REQUESTED,
  AuditAction.REWARD_CREDITED,
]);

const USER_ACTIONS = new Set([
  AuditAction.USER_SUSPENDED,
  AuditAction.USER_BANNED,
  AuditAction.USER_UNSUSPENDED,
  AuditAction.USER_UNBANNED,
  AuditAction.USER_VERIFIED,
  AuditAction.USER_REGISTERED,
  AuditAction.USER_PROFILE_UPDATED,
]);

const QUESTION_ACTIONS = new Set([
  AuditAction.QUESTION_APPROVED,
  AuditAction.QUESTION_REJECTED,
  'question_held',
  AuditAction.QUESTION_SUBMITTED,
]);

export interface AuditLogItem {
  id: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActorStats {
  actorId: string;
  actorName: string;
  actorRole: string;
  withdrawalApproved: number;
  withdrawalRejected: number;
  withdrawalProcessed: number;
  withdrawalRetried: number;
  userSuspended: number;
  userBanned: number;
  userUnsuspended: number;
  userUnbanned: number;
  userVerified: number;
  questionApproved: number;
  questionRejected: number;
  questionHeld: number;
  configUpdated: number;
  totalActions: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  async queryAuditLogs(dto: QueryAuditLogsDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const qb = this.auditRepo.createQueryBuilder('al')
      .leftJoin('users', 'u', 'al.actor_id = u.id AND al.actor_type IN (:...types)', {
        types: ['admin', 'curator'],
      })
      .select([
        'al.id',
        'al.actorType',
        'al.actorId',
        'u.name',
        'u.role',
        'al.action',
        'al.entityType',
        'al.entityId',
        'al.oldValue',
        'al.newValue',
        'al.metadata',
        'al.createdAt',
      ]);

    if (dto.actorId) {
      qb.andWhere('al.actor_id = :actorId', { actorId: dto.actorId });
    }
    if (dto.actorType) {
      qb.andWhere('al.actor_type = :actorType', { actorType: dto.actorType });
    }
    if (dto.actions?.length) {
      qb.andWhere('al.action IN (:...actions)', { actions: dto.actions });
    } else if (dto.action) {
      qb.andWhere('al.action = :action', { action: dto.action });
    }
    if (dto.entityType) {
      qb.andWhere('al.entity_type = :entityType', { entityType: dto.entityType });
    }
    if (dto.entityId) {
      qb.andWhere('al.entity_id = :entityId', { entityId: dto.entityId });
    }
    if (dto.fromDate) {
      qb.andWhere('al.created_at >= :fromDate', { fromDate: dto.fromDate });
    }
    if (dto.toDate) {
      qb.andWhere('al.created_at <= :toDate', { toDate: dto.toDate });
    }
    if (dto.search) {
      qb.andWhere(
        `(al.action ILIKE :search OR al.entity_type ILIKE :search OR CAST(al.metadata AS TEXT) ILIKE :search)`,
        { search: `%${dto.search}%` },
      );
    }

    const sortBy = dto.sortBy ?? 'createdAt';
    const sortMap: Record<string, string> = {
      createdAt: 'al.createdAt',
      action: 'al.action',
      actorId: 'al.actorId',
    };
    qb.orderBy(sortMap[sortBy] ?? 'al.createdAt', dto.sortOrder === 'ASC' ? 'ASC' : 'DESC');

    qb.skip(offset).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const mapped: AuditLogItem[] = items.map((item) => ({
      id: item.id,
      actorType: item.actorType,
      actorId: item.actorId,
      actorName: (item as unknown as { u?: { name?: string } }).u?.name ?? null,
      actorRole: (item as unknown as { u?: { role?: string } }).u?.role ?? null,
      action: item.action,
      entityType: item.entityType,
      entityId: item.entityId,
      oldValue: item.oldValue,
      newValue: item.newValue,
      metadata: item.metadata,
      createdAt: item.createdAt.toISOString(),
    }));

    return {
      items: mapped,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async getActorStats(dto: AuditStatsDto) {
    const qb = this.auditRepo.createQueryBuilder('al')
      .leftJoin('users', 'u', 'al.actor_id = u.id')
      .select([
        'al.actor_id AS "actorId"',
        'u.name AS "actorName"',
        'u.role AS "actorRole"',
        'al.action AS action',
      ])
      .where('al.actor_type IN (:...types)', { types: ['admin', 'curator'] });

    if (dto.fromDate) {
      qb.andWhere('al.created_at >= :fromDate', { fromDate: dto.fromDate });
    }
    if (dto.toDate) {
      qb.andWhere('al.created_at <= :toDate', { toDate: dto.toDate });
    }
    if (dto.actorType) {
      qb.andWhere('al.actor_type = :actorType', { actorType: dto.actorType });
    }

    const rows: Array<{
      actorId: string;
      actorName: string;
      actorRole: string;
      action: string;
    }> = await qb.getRawMany();

    const actorMap = new Map<string, ActorStats>();

    for (const row of rows) {
      if (!actorMap.has(row.actorId)) {
        actorMap.set(row.actorId, {
          actorId: row.actorId,
          actorName: row.actorName ?? row.actorId,
          actorRole: row.actorRole ?? 'unknown',
          withdrawalApproved: 0,
          withdrawalRejected: 0,
          withdrawalProcessed: 0,
          withdrawalRetried: 0,
          userSuspended: 0,
          userBanned: 0,
          userUnsuspended: 0,
          userUnbanned: 0,
          userVerified: 0,
          questionApproved: 0,
          questionRejected: 0,
          questionHeld: 0,
          configUpdated: 0,
          totalActions: 0,
        });
      }
      const stats = actorMap.get(row.actorId)!;
      stats.totalActions++;

      switch (row.action) {
        case AuditAction.WITHDRAWAL_COMPLETED:
          stats.withdrawalProcessed++;
          break;
        case 'withdrawal_approved':
          stats.withdrawalApproved++;
          break;
        case 'withdrawal_rejected':
          stats.withdrawalRejected++;
          break;
        case 'withdrawal_retry':
          stats.withdrawalRetried++;
          break;
        case AuditAction.USER_SUSPENDED:
          stats.userSuspended++;
          break;
        case AuditAction.USER_BANNED:
          stats.userBanned++;
          break;
        case AuditAction.USER_UNSUSPENDED:
          stats.userUnsuspended++;
          break;
        case AuditAction.USER_UNBANNED:
          stats.userUnbanned++;
          break;
        case AuditAction.USER_VERIFIED:
          stats.userVerified++;
          break;
        case AuditAction.QUESTION_APPROVED:
          stats.questionApproved++;
          break;
        case AuditAction.QUESTION_REJECTED:
          stats.questionRejected++;
          break;
        case 'question_held':
          stats.questionHeld++;
          break;
        case AuditAction.ADMIN_CONFIG_UPDATED:
          stats.configUpdated++;
          break;
      }
    }

    const actors = Array.from(actorMap.values()).sort(
      (a, b) => b.totalActions - a.totalActions,
    );

    const totalActions = actors.reduce((sum, a) => sum + a.totalActions, 0);
    const topActor = actors[0] ?? null;

    return {
      fromDate: dto.fromDate ?? null,
      toDate: dto.toDate ?? null,
      actors,
      summary: {
        totalActions,
        uniqueActors: actors.length,
        mostActiveActor: topActor?.actorId ?? null,
        mostActiveActorName: topActor?.actorName ?? null,
      },
    };
  }

  async getEntityHistory(entityType: string, entityId: string) {
    const entries = await this.auditRepo.find({
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
    });

    const qb = this.auditRepo.createQueryBuilder('al')
      .leftJoin('users', 'u', 'al.actor_id = u.id AND al.actor_type IN (:...types)', {
        types: ['admin', 'curator'],
      })
      .select(['al.id', 'al.actorType', 'al.actorId', 'u.name', 'al.action', 'al.oldValue', 'al.newValue', 'al.metadata', 'al.createdAt'])
      .where('al.entity_type = :entityType', { entityType })
      .andWhere('al.entity_id = :entityId', { entityId })
      .orderBy('al.created_at', 'ASC');

    const rows = await qb.getMany();

    return {
      entityType,
      entityId,
      entries: rows.map((item) => ({
        id: item.id,
        actorType: item.actorType,
        actorId: item.actorId,
        actorName: (item as unknown as { u?: { name?: string } }).u?.name ?? null,
        action: item.action,
        oldValue: item.oldValue,
        newValue: item.newValue,
        metadata: item.metadata,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async getSummary(dto: AuditStatsDto & { granularity?: string }) {
    const fromDate = dto.fromDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = dto.toDate ?? new Date().toISOString();
    const granularity = dto.granularity ?? 'day';

    let dateTrunc: string;
    switch (granularity) {
      case 'week':
        dateTrunc = "TO_CHAR(al.created_at, 'IYYY-IW')";
        break;
      case 'month':
        dateTrunc = "TO_CHAR(al.created_at, 'YYYY-MM')";
        break;
      default:
        dateTrunc = "TO_CHAR(al.created_at, 'YYYY-MM-DD')";
    }

    const rows: Array<{
      date: string;
      action: string;
      count: string;
    }> = await this.dataSource.query(
      `
      SELECT
        ${dateTrunc} AS date,
        al.action,
        COUNT(*) AS count
      FROM audit_logs al
      WHERE al.created_at >= $1 AND al.created_at <= $2
      GROUP BY date, al.action
      ORDER BY date ASC
      `,
      [fromDate, toDate],
    );

    const seriesMap = new Map<string, {
      date: string;
      withdrawals: number;
      userActions: number;
      questionReviews: number;
      configChanges: number;
      total: number;
    }>();

    for (const row of rows) {
      if (!seriesMap.has(row.date)) {
        seriesMap.set(row.date, {
          date: row.date,
          withdrawals: 0,
          userActions: 0,
          questionReviews: 0,
          configChanges: 0,
          total: 0,
        });
      }
      const s = seriesMap.get(row.date)!;
      const cat = ACTION_CATEGORY[row.action] ?? 'auth';
      const cnt = parseInt(row.count, 10);
      s.total += cnt;
      switch (cat) {
        case 'withdrawal': s.withdrawals += cnt; break;
        case 'user': s.userActions += cnt; break;
        case 'question': s.questionReviews += cnt; break;
        case 'config': s.configChanges += cnt; break;
      }
    }

    return {
      granularity: granularity as 'day' | 'week' | 'month',
      series: Array.from(seriesMap.values()),
    };
  }
}