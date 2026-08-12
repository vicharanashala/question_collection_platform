import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IAuditLogRepository } from '../../IAuditLog.repository';
import { AuditLog } from '../../../entities';
import { ActorType } from '../../../../classes/enums';

@Injectable()
export class MongoAuditLogRepository
  extends MongoRepository<AuditLog>
  implements IAuditLogRepository
{
  constructor(@InjectModel('AuditLog') protected readonly _model: Model<AuditLog>) {
    super(_model);
  }

  async findByActorId(actorId: string, actorType: ActorType, limit = 50): Promise<AuditLog[]> {
    return this._model
      .find({ actorId, actorType }, undefined, { limit, sort: { createdAt: -1 } })
      .exec() as Promise<AuditLog[]>;
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this._model
      .find({ entityType, entityId })
      .sort({ createdAt: -1 })
      .exec() as Promise<AuditLog[]>;
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
}