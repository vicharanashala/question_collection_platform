import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IAgriEntityRepository } from '../../IAgriEntity.repository';
import { AgriEntity } from '../../../entities';

@Injectable()
export class MongoAgriEntityRepository
  extends MongoRepository<AgriEntity>
  implements IAgriEntityRepository
{
  constructor(@InjectModel('AgriEntity') protected readonly _model: Model<AgriEntity>) {
    super(_model);
  }
}
