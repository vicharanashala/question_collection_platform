import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IAppFeedbackRepository } from '../../IAppFeedback.repository';
import { AppFeedback } from '../../../entities';

@Injectable()
export class MongoAppFeedbackRepository
  extends MongoRepository<AppFeedback>
  implements IAppFeedbackRepository
{
  constructor(@InjectModel('AppFeedback') protected readonly _model: Model<AppFeedback>) {
    super(_model);
  }
}
