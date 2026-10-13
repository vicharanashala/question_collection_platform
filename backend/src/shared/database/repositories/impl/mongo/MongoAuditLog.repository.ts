import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, QueryFilter } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IAuditLogRepository } from '../../IAuditLog.repository';
import { ActorType } from '../../../../classes/enums';
import { AuditLog } from '@/shared/database/mongodb/schemas/audit-log.schema';
import { QueryAuditLogsDto } from '@/modules/audit-logs/dto/query-audit-log-dto';

const SORT_FIELDS = {
  createdAt: 'createdAt',
  actionType: 'actionType',
  actorId: 'actor.id',
} as const;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class MongoAuditLogRepository
  extends MongoRepository<AuditLog>
  implements IAuditLogRepository
{
  constructor(@InjectModel('AuditLog') protected readonly _model: Model<AuditLog>) {
    super(_model);
  }

  private buildAuditFilter(q: QueryAuditLogsDto): QueryFilter<AuditLog>{
     const filter: QueryFilter<AuditLog> = { resource: { $exists: true } };

  if (q.role) filter['actor.actorType'] = q.role;
  if (q.actorId) filter['actor.id'] = q.actorId;

  const types = [...(q.actionTypes ?? []), ...(q.actionType ? [q.actionType] : [])];
  if (types.length) filter.actionType = { $in: types };

  if (q.fromDate || q.toDate) {
    const range: Record<string, Date> = {};
    if (q.fromDate) range.$gte = new Date(q.fromDate);
    if (q.toDate) {
      const end = new Date(q.toDate);
      if (DATE_ONLY.test(q.toDate)) {
        end.setUTCDate(end.getUTCDate() + 1); // date-only: include the whole day
        range.$lt = end;
      } else {
        range.$lte = end; // full timestamp: use as given
      }
    }
    filter.createdAt = range;
  }

  if (q.search) {
    const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ 'actor.name': rx }, { 'actor.email': rx }];
  }
  return filter;
  }

  /**
   * MongoDB aggregation pipeline for audit log analytics.
   * Supports date truncation by day/week/month.
   */
  async aggregateByAction(
    fromDate: Date,
    toDate: Date,
    actorTypes?: string[],
    granularity: 'day' | 'week' | 'month' = 'day',
  ): Promise<Array<{ date: string; action: string; count: number }>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dateFormat: any =
      granularity === 'week'
        ? { $dateToString: { format: '%Y-%V', date: '$createdAt' } }
        : granularity === 'month'
        ? { $dateToString: { format: '%Y-%m', date: '$createdAt' } }
        : { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };

    const match: Record<string, unknown> = {
      createdAt: { $gte: fromDate, $lte: toDate },
    };
    if (actorTypes?.length) {
      match.actorType = { $in: actorTypes };
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $group: {
          _id: {
            date: dateFormat,
            action: '$action',
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          action: '$_id.action',
          count: 1,
        },
      },
      { $sort: { date: 1 } },
    ];

    return this._model.aggregate(pipeline).exec() as Promise<Array<{ date: string; action: string; count: number }>>;
  }

  async findPage(q: QueryAuditLogsDto, scope: Record<string, unknown> | null = null) {
  const page = q.page ?? 1;
  const limit = q.limit ?? 50;

  const base = this.buildAuditFilter(q);
  const filter = scope ? { $and: [base, scope] } : base;

  const [data, total] = await this.createQueryBuilder('a')
    .whereRaw(filter)
    .orderBy(SORT_FIELDS[q.sortBy ?? 'createdAt'], q.sortOrder ?? 'DESC')
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

 }