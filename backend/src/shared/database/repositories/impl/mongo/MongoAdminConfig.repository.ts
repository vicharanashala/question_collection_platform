import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IAdminConfigRepository } from '../../IAdminConfig.repository';
import { AdminConfig } from '../../../entities';

@Injectable()
export class MongoAdminConfigRepository
  extends MongoRepository<AdminConfig>
  implements IAdminConfigRepository
{
  constructor(@InjectModel('AdminConfig') protected readonly _model: Model<AdminConfig>) {
    super(_model);
  }

  async findByKey(key: string): Promise<AdminConfig | null> {
    return this._model.findOne({ key }).exec() as Promise<AdminConfig | null>;
  }
}