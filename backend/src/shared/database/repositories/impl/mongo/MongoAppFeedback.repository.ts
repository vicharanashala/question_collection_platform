import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { FeedbackRatingSummary, IAppFeedbackRepository } from '../../IAppFeedback.repository';
import { AppFeedback, AppFeedbackContext } from '../../../entities';

@Injectable()
export class MongoAppFeedbackRepository
  extends MongoRepository<AppFeedback>
  implements IAppFeedbackRepository
{
  constructor(@InjectModel('AppFeedback') protected readonly _model: Model<AppFeedback>) {
    super(_model);
  }

  async getRatingSummary(context: AppFeedbackContext): Promise<FeedbackRatingSummary> {
    const rows = await this._model
      .aggregate<{ _id: number; count: number }>([
        { $match: { context } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ])
      .exec();

    const distribution: FeedbackRatingSummary['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let ratingSum = 0;
    for (const row of rows) {
      if (row._id >= 1 && row._id <= 5) distribution[row._id as 1 | 2 | 3 | 4 | 5] = row.count;
      total += row.count;
      ratingSum += row._id * row.count;
    }
    return { total, averageRating: total ? Math.round((ratingSum / total) * 10) / 10 : null, distribution };
  }
}
