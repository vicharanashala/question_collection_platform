import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IAgriEntityRepository, SubmissionOrderQuery, UserAgriEntityTypeCount } from '../../IAgriEntity.repository';
import { AgriEntityType } from '../../../../classes/enums';
import { AgriEntity } from '../../../entities';

@Injectable()
export class MongoAgriEntityRepository
  extends MongoRepository<AgriEntity>
  implements IAgriEntityRepository
{
  constructor(@InjectModel('AgriEntity') protected readonly _model: Model<AgriEntity>) {
    super(_model);
  }

  async countByUsersAndType(userIds: string[]): Promise<UserAgriEntityTypeCount[]> {
    if (userIds.length === 0) return [];
    const rows = await this._model
      .aggregate<{ _id: { userId: string; type: AgriEntityType }; count: number }>([
        { $match: { userId: { $in: userIds }, isDeleted: { $in: [true, false, null] }  } },
        { $group: { _id: { userId: '$userId', type: '$type' }, count: { $sum: 1 } } },
      ])
      .exec();
    return rows.map((r) => ({ userId: r._id.userId, type: r._id.type, count: r.count }));
  }

  // Pages entities by submission time, using the id as a tie breaker so pages never overlap.
  async findOrderedBySubmission({ filter, order, page = 1, limit }: SubmissionOrderQuery) {
    const direction = order === 'asc' ? 1 : -1;
    const [rows, total] = await Promise.all([
      this._model
        .aggregate<{ _id: string }>([
          { $match: filter },
          { $addFields: { submittedAt: { $ifNull: ['$submissionLocation.capturedAt', '$createdAt'] } } },
          { $sort: { submittedAt: direction, _id: direction } },
          ...(limit ? [{ $skip: (page - 1) * limit }, { $limit: limit }] : []),
          { $project: { _id: 1 } },
        ])
        .exec(),
      this._model.countDocuments(filter).exec(),
    ]);
    // Ids may come back as native ObjectIds, so compare them as strings.
    const ids = rows.map((row) => String(row._id));
    const entities = await this.findAll({ id: { $in: ids } } as never);
    const byId = new Map(entities.map((entity) => [entity.id, entity]));
    const data = ids.map((id) => byId.get(id)).filter((entity): entity is AgriEntity => !!entity);
    return { data, total };
  }
}
