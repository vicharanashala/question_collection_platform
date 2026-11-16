import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IAnveshanAnswerRepository } from '../../anveshan-answer.repository.interface';
import { AnveshanAnswer } from '../../../entities';

@Injectable()
export class MongoAnveshanAnswerRepository
  extends MongoRepository<AnveshanAnswer>
  implements IAnveshanAnswerRepository
{
  constructor(@InjectModel('AnveshanAnswer') protected readonly _model: Model<AnveshanAnswer>) {
    super(_model);
  }
}
