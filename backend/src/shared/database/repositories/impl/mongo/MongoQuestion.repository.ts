import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import {
  DailyVolumeRow,
  IQuestionRepository,
} from '../../IQuestion.repository';
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

  // ─── Aggregations (native MongoDB pipelines) ─────────────────────────────

  async countByStatuses(
    statuses: QuestionStatus[],
  ): Promise<Array<{ status: QuestionStatus; count: number }>> {
    if (statuses.length === 0) return [];
    const rows = await this._model
      .aggregate<{ _id: QuestionStatus; count: number }>([
        { $match: { status: { $in: statuses } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();
    return rows.map((r) => ({ status: r._id, count: r.count }));
  }

  async dailyVolumeSince(from: Date): Promise<DailyVolumeRow[]> {
    const rows = await this._model
      .aggregate<{
        _id: string;
        submitted: number;
        approved: number;
        rejected: number;
        held: number;
      }>([
        { $match: { submittedAt: { $gte: from } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' },
            },
            submitted: { $sum: 1 },
            approved: {
              $sum: { $cond: [{ $eq: ['$status', QuestionStatus.APPROVED] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', QuestionStatus.REJECTED] }, 1, 0] },
            },
            held: {
              $sum: { $cond: [{ $eq: ['$status', QuestionStatus.HELD] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .exec();
    return rows.map((r) => ({
      date: r._id,
      submitted: r.submitted,
      approved: r.approved,
      rejected: r.rejected,
      held: r.held,
    }));
  }

  async topFieldSince(
    field: 'cropType' | 'state',
    from: Date,
    limit: number,
  ): Promise<Array<{ key: string; count: number }>> {
    const rows = await this._model
      .aggregate<{ _id: string; count: number }>([
        { $match: { submittedAt: { $gte: from } } },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ])
      .exec();
    return rows
      .filter((r) => r._id != null && r._id !== '')
      .map((r) => ({ key: String(r._id), count: r.count }));
  }

  async topDomainsSince(
    from: Date,
    limit: number,
  ): Promise<Array<{ domain: string; count: number }>> {
    const rows = await this._model
      .aggregate<{ _id: string; count: number }>([
        { $match: { submittedAt: { $gte: from } } },
        { $unwind: '$domains' },
        { $group: { _id: '$domains', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
      ])
      .exec();
    return rows
      .filter((r) => r._id != null && r._id !== '')
      .map((r) => ({ domain: String(r._id), count: r.count }));
  }

  async avgReviewTurnaroundMinutesSince(
    from: Date,
    statuses: QuestionStatus[],
  ): Promise<number | null> {
    if (statuses.length === 0) return null;
    const row = await this._model
      .aggregate<{ avgMs: number | null }>([
        {
          $match: {
            reviewedAt: { $ne: null, $gte: from },
            status: { $in: statuses },
          },
        },
        {
          $project: {
            turnaroundMs: { $subtract: ['$reviewedAt', '$submittedAt'] },
          },
        },
        {
          $group: {
            _id: null,
            avgMs: { $avg: '$turnaroundMs' },
          },
        },
      ])
      .exec();
    const avgMs = row[0]?.avgMs;
    if (avgMs == null) return null;
    return Math.round(avgMs / 60000);
  }
}