import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuditLog } from '../database/entities';
import { AuditAction, UserRole } from '../common/enums';
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

/** Roles that ADMIN role can view audit logs for (excludes admin/super_admin) */
const ADMIN_VIEWABLE_ROLES = [UserRole.CURATOR, UserRole.FINANCE];
/** All non-super_admin roles (what ADMIN can be assigned to view) */
const ADMIN_ASSIGNABLE_ROLES = [UserRole.CURATOR, UserRole.FINANCE];

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Returns the actorType value stored in audit_logs for a given UserRole.
   * ADMIN, SUPER_ADMIN both use 'admin' in actor_type; FINANCE uses 'finance'.
   */
  private actorTypeForRole(role: UserRole): string {
    if (role === UserRole.FINANCE) return 'finance';
    return 'admin';
  }

  /**
   * Build the actor type filter and allowed-roles logic for queryAuditLogs.
   * Returns { actorTypes, roles, disallowAdminRole } to be applied as WHERE clauses.
   */
  private buildRoleFilters(
    dto: QueryAuditLogsDto,
    authId: string,
    authRole: UserRole,
  ): { actorTypes: string[] | null; roles: UserRole[] | null; disallowAdminRole: boolean } {
    if (authRole === UserRole.SUPER_ADMIN) {
      if (!dto.role) {
        return { actorTypes: null, roles: null, disallowAdminRole: false };
      }
      const actorTypes = [this.actorTypeForRole(dto.role)];
      const roles = [dto.role];
      return { actorTypes, roles, disallowAdminRole: false };
    }

    // ADMIN can only view curator + finance
    if (dto.role) {
      if (!ADMIN_VIEWABLE_ROLES.includes(dto.role)) {
        // Silently return empty result for disallowed roles
        return { actorTypes: ['__impossible__'], roles: [], disallowAdminRole: true };
      }
      return {
        actorTypes: [this.actorTypeForRole(dto.role)],
        roles: [dto.role],
        disallowAdminRole: false,
      };
    }

    // No role selected → show curator + finance combined
    return {
      actorTypes: ADMIN_VIEWABLE_ROLES.map((r) => this.actorTypeForRole(r)),
      roles: ADMIN_VIEWABLE_ROLES,
      disallowAdminRole: false,
    };
  }

  private buildStatsRoleFilters(
    dto: AuditStatsDto,
    _authId: string,
    authRole: UserRole,
  ): { actorTypes: string[] | null; roles: UserRole[] | null; disallowAdminRole: boolean } {
    if (authRole === UserRole.SUPER_ADMIN) {
      if (!dto.role) {
        return { actorTypes: null, roles: null, disallowAdminRole: false };
      }
      return {
        actorTypes: [this.actorTypeForRole(dto.role)],
        roles: [dto.role],
        disallowAdminRole: false,
      };
    }

    if (dto.role) {
      if (!ADMIN_VIEWABLE_ROLES.includes(dto.role)) {
        return { actorTypes: ['__impossible__'], roles: [], disallowAdminRole: true };
      }
      return {
        actorTypes: [this.actorTypeForRole(dto.role)],
        roles: [dto.role],
        disallowAdminRole: false,
      };
    }

    return {
      actorTypes: ADMIN_VIEWABLE_ROLES.map((r) => this.actorTypeForRole(r)),
      roles: ADMIN_VIEWABLE_ROLES,
      disallowAdminRole: false,
    };
  }

  // ─── Main query ────────────────────────────────────────────────────────────

  async queryAuditLogs(dto: QueryAuditLogsDto, authId: string, authRole: UserRole) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const qb = this.auditRepo.createQueryBuilder('al')
      .leftJoin('users', 'u', 'al.actor_id = u.id AND al.actor_type IN (:...types)', {
        types: ['admin', 'curator', 'finance'],
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

    // Role-based actor filtering
    const { actorTypes, roles, disallowAdminRole } = this.buildRoleFilters(dto, authId, authRole);

    if (disallowAdminRole) {
      return { items: [], total: 0, page, limit, pages: 0 };
    }

    if (actorTypes) {
      qb.andWhere('al.actor_type IN (:...actorTypes)', { actorTypes });
    }
    if (roles) {
      qb.andWhere('u.role IN (:...roles)', { roles });
    }
    if (dto.actorId) {
      // If actorId is specified, verify it belongs to an allowed actor
      if (authRole === UserRole.ADMIN) {
        // Verify the target actor is a curator or finance user
        const targetUser = await this.dataSource
          .getRepository('user')
          .findOne({ where: { id: dto.actorId }, select: ['role'] });
        if (!targetUser || !ADMIN_VIEWABLE_ROLES.includes(targetUser.role as UserRole)) {
          return { items: [], total: 0, page, limit, pages: 0 };
        }
      }
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

    return { items: mapped, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ─── Actor stats ──────────────────────────────────────────────────────────

  async getActorStats(dto: AuditStatsDto, _authId: string, authRole: UserRole) {
    const { actorTypes, roles, disallowAdminRole } = this.buildStatsRoleFilters(dto, _authId, authRole);

    if (disallowAdminRole) {
      return {
        fromDate: dto.fromDate ?? null,
        toDate: dto.toDate ?? null,
        actors: [],
        summary: { totalActions: 0, uniqueActors: 0, mostActiveActor: null, mostActiveActorName: null },
      };
    }

    const qb = this.auditRepo.createQueryBuilder('al')
      .leftJoin('users', 'u', 'al.actor_id = u.id')
      .select([
        'al.actor_id AS "actorId"',
        'u.name AS "actorName"',
        'u.role AS "actorRole"',
        'al.action AS action',
      ])
      .where('al.actor_type IN (:...types)', {
        types: actorTypes ?? ['admin', 'curator', 'finance'],
      });

    if (roles) {
      qb.andWhere('u.role IN (:...roles)', { roles });
    }
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

  // ─── Summary ──────────────────────────────────────────────────────────────

  async getSummary(dto: AuditStatsDto & { granularity?: string }, _authId: string, authRole: UserRole) {
    const { actorTypes, roles, disallowAdminRole } = this.buildStatsRoleFilters(dto, _authId, authRole);

    if (disallowAdminRole) {
      return { granularity: (dto.granularity ?? 'day') as 'day' | 'week' | 'month', series: [] };
    }

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

    const typeCondition = actorTypes
      ? `AND al.actor_type IN (${actorTypes.map((_, i) => `$${i + 3}`).join(',')})`
      : '';

    const params: unknown[] = [fromDate, toDate];
    if (actorTypes) params.push(...actorTypes);

    const rows: Array<{ date: string; action: string; count: string }> = await this.dataSource.query(
      `
      SELECT
        ${dateTrunc} AS date,
        al.action,
        COUNT(*) AS count
      FROM audit_logs al
      WHERE al.created_at >= $1 AND al.created_at <= $2
      ${typeCondition}
      GROUP BY date, al.action
      ORDER BY date ASC
      `,
      params,
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

  // ─── Entity history ────────────────────────────────────────────────────────

  async getEntityHistory(
    entityType: string,
    entityId: string,
    _authId: string,
    authRole: UserRole,
  ) {
    // Role-based filtering on entity history
    let allowedActorTypes: string[] | null = null;
    if (authRole === UserRole.ADMIN) {
      allowedActorTypes = ADMIN_VIEWABLE_ROLES.map((r) => this.actorTypeForRole(r));
    }

    const qb = this.auditRepo.createQueryBuilder('al')
      .leftJoin('users', 'u', 'al.actor_id = u.id AND al.actor_type IN (:...types)', {
        types: ['admin', 'curator', 'finance'],
      })
      .select([
        'al.id', 'al.actorType', 'al.actorId', 'u.name', 'al.action',
        'al.oldValue', 'al.newValue', 'al.metadata', 'al.createdAt',
      ])
      .where('al.entity_type = :entityType', { entityType })
      .andWhere('al.entity_id = :entityId', { entityId })
      .orderBy('al.created_at', 'ASC');

    if (allowedActorTypes) {
      qb.andWhere('al.actor_type IN (:...allowedActorTypes)', { allowedActorTypes });
    }

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

  // ─── Users by role ─────────────────────────────────────────────────────────

  async getUsersByRole(role: UserRole, authId: string, authRole: UserRole) {
    // Permission check
    if (authRole === UserRole.ADMIN && role !== UserRole.CURATOR && role !== UserRole.FINANCE) {
      // Admin cannot list admin or super_admin users
      return { users: [] };
    }

    const qb = this.dataSource
      .getRepository('user')
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.mobileNumber', 'u.role'])
      .where('u.role = :role', { role })
      .orderBy('u.name', 'ASC');

    const users = await qb.getMany();

    return {
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        mobileNumber: u.mobileNumber,
        role: u.role,
      })),
    };
  }
}