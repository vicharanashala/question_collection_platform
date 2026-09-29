import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IAgriEntityRepository, UserAgriEntityTypeCount } from '../../IAgriEntity.repository';
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
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: { userId: '$userId', type: '$type' }, count: { $sum: 1 } } },
      ])
      .exec();
    return rows.map((r) => ({ userId: r._id.userId, type: r._id.type, count: r.count }));
  }
}
