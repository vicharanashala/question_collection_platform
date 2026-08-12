import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IReportReplyRepository } from '../../IReportReply.repository';
import { ReportReply } from '../../../entities';

@Injectable()
export class MongoReportReplyRepository
  extends MongoRepository<ReportReply>
  implements IReportReplyRepository
{
  constructor(@InjectModel('ReportReply') protected readonly _model: Model<ReportReply>) {
    super(_model);
  }

  async findByReportId(reportId: string): Promise<ReportReply[]> {
    return this._model
      .find({ reportId } as Record<string, unknown>, undefined, { sort: { createdAt: 1 } })
      .exec() as Promise<ReportReply[]>;
  }
}