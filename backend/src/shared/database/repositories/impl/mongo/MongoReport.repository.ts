import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IReportRepository } from '../../IReport.repository';
import { Report } from '../../../entities';
import { ReportStatus } from '../../../../classes/enums';

@Injectable()
export class MongoReportRepository
  extends MongoRepository<Report>
  implements IReportRepository
{
  constructor(@InjectModel('Report') protected readonly _model: Model<Report>) {
    super(_model);
  }

  async findByUserId(userId: string, limit = 20): Promise<Report[]> {
    return this._model
      .find({ userId } as Record<string, unknown>, undefined, { limit, sort: { createdAt: -1 } })
      .exec() as Promise<Report[]>;
  }

  async findByStatus(status: ReportStatus, limit = 50): Promise<Report[]> {
    return this._model
      .find({ status } as Record<string, unknown>, undefined, { limit, sort: { createdAt: -1 } })
      .exec() as Promise<Report[]>;
  }
}