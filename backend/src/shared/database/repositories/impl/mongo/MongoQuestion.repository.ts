import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IQuestionRepository } from '../../IQuestion.repository';
import { Question } from '../../../entities';
import { QuestionStatus } from '../../../../classes/enums';
import { mongoLike, escapeRegex } from '../../../abstractions/mongo-utils';

@Injectable()
export class MongoQuestionRepository
  extends MongoRepository<Question>
  implements IQuestionRepository
{
  constructor(@InjectModel('Question') protected readonly _model: Model<Question>) {
    super(_model);
  }

  async findByUserId(
    userId: string,
    status?: QuestionStatus,
    limit?: number,
  ): Promise<Question[]> {
    const filter: Record<string, unknown> = { userId };
    if (status) filter.status = status;
    const q = this._model.find(filter as Record<string, unknown>).sort({ submittedAt: -1 });
    if (limit) q.limit(limit);
    return q.exec() as Promise<Question[]>;
  }

  async countByUserId(userId: string, status?: QuestionStatus): Promise<number> {
    const filter: Record<string, unknown> = { userId };
    if (status) filter.status = status;
    return this._model.countDocuments(filter as Record<string, unknown>).exec();
  }

  async searchByText(text: string, limit = 10): Promise<Question[]> {
    return this._model
      .find({ questionText: mongoLike(text) } as Record<string, unknown>, undefined, { limit })
      .exec() as Promise<Question[]>;
  }

  async findExactDuplicate(
    userId: string,
    questionText: string,
    state: string,
    district: string,
  ): Promise<Question | null> {
    return this._model
      .findOne({
        userId,
        state,
        district,
        // Case-insensitive match on questionText — mirrors Postgres LOWER() behaviour
        questionText: { $regex: `^${escapeRegex(questionText)}$`, $options: 'i' },
      } as Record<string, unknown>)
      .exec() as Promise<Question | null>;
  }

  async getLeaderboard(
    limit: number,
  ): Promise<Array<{ userId: string; approvedCount: number }>> {
    return this._model
      .aggregate([
        { $match: { status: QuestionStatus.APPROVED } },
        { $group: { _id: '$userId', approvedCount: { $sum: 1 } } },
        { $sort: { approvedCount: -1 } },
        { $limit: limit },
        { $project: { _id: 0, userId: '$_id', approvedCount: 1 } },
      ])
      .exec() as Promise<Array<{ userId: string; approvedCount: number }>>;
  }
}