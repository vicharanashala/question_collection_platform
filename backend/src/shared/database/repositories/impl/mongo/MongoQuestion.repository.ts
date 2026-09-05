import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import {
  DailyVolumeRow,
  IQuestionRepository,
  QuestionAnalyticsFilters,
  QuestionAnalyticsResult,
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

  async getQuestionAnalytics(
  filters: QuestionAnalyticsFilters,
): Promise<QuestionAnalyticsResult> {
  const { from, to, state, cropType } = filters;

  const match: Record<string, unknown> = {
    submittedAt: {
      $gte: from,
      $lte: to,
    },
  };

  if (state) {
    match.state = state;
  }

  if (cropType) {
    match.cropType = cropType;
  }

  const [result] = await this._model.aggregate([
    {
      $match: match,
    },

    {
      $facet: {
        // ------------------------------------------
        // Summary
        // ------------------------------------------
        summary: [
          {
            $group: {
              _id: null,

              total: {
                $sum: 1,
              },

              approved: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', QuestionStatus.APPROVED] },
                    1,
                    0,
                  ],
                },
              },

              rejected: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', QuestionStatus.REJECTED] },
                    1,
                    0,
                  ],
                },
              },

              pending: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        '$status',
                        [
                          QuestionStatus.PENDING,
                          QuestionStatus.HELD,
                        ],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],

        // ------------------------------------------
        // Daily volume
        // ------------------------------------------
        dailyVolume: [
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$submittedAt',
                },
              },

              submitted: {
                $sum: 1,
              },

              approved: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', QuestionStatus.APPROVED] },
                    1,
                    0,
                  ],
                },
              },

              rejected: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', QuestionStatus.REJECTED] },
                    1,
                    0,
                  ],
                },
              },
            },
          },

          {
            $sort: {
              _id: 1,
            },
          },
        ],

        // ------------------------------------------
        // State breakdown
        // ------------------------------------------
        stateBreakdown: [
          {
            $group: {
              _id: '$state',

              count: {
                $sum: 1,
              },

              approved: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', QuestionStatus.APPROVED] },
                    1,
                    0,
                  ],
                },
              },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },

          {
            $limit: 20,
          },
        ],

        // ------------------------------------------
        // Crop breakdown
        // ------------------------------------------
        cropBreakdown: [
          {
            $group: {
              _id: '$cropType',

              count: {
                $sum: 1,
              },

              approved: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', QuestionStatus.APPROVED] },
                    1,
                    0,
                  ],
                },
              },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },

          {
            $limit: 15,
          },
        ],

        // ------------------------------------------
        // Domain breakdown
        // ------------------------------------------
        domainBreakdown: [
          {
            $unwind: '$domains',
          },

          {
            $group: {
              _id: '$domains',

              count: {
                $sum: 1,
              },

              approved: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', QuestionStatus.APPROVED] },
                    1,
                    0,
                  ],
                },
              },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },
        ],

        // ------------------------------------------
        // District breakdown
        // ------------------------------------------
        districtBreakdown: [
          {
            $match: {
              district: {
                $ne: null,
              },
            },
          },

          {
            $group: {
              _id: {
                district: '$district',
                state: '$state',
              },

              count: {
                $sum: 1,
              },

              approved: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', QuestionStatus.APPROVED] },
                    1,
                    0,
                  ],
                },
              },
            },
          },

          {
            $sort: {
              count: -1,
            },
          },

          {
            $limit: 50,
          },
        ],
      },
    },
  ]).exec();

  const summary = result?.summary?.[0];

  return {
    summary: {
      total: summary?.total ?? 0,
      approved: summary?.approved ?? 0,
      rejected: summary?.rejected ?? 0,
      pending: summary?.pending ?? 0,
    },

    dailyVolume: (result?.dailyVolume ?? []).map((row:any) => ({
      date: row._id,
      submitted: row.submitted,
      approved: row.approved,
      rejected: row.rejected,
    })),

    stateBreakdown: (result?.stateBreakdown ?? [])
      .filter((row:any) => row._id != null && row._id !== '')
      .map((row:any) => ({
        state: String(row._id),
        count: row.count,
        approved: row.approved,
      })),

    cropBreakdown: (result?.cropBreakdown ?? [])
      .filter((row:any) => row._id != null && row._id !== '')
      .map((row:any) => ({
        cropType: String(row._id),
        count: row.count,
        approved: row.approved,
      })),

    domainBreakdown: (result?.domainBreakdown ?? [])
      .filter((row:any) => row._id != null && row._id !== '')
      .map((row:any) => ({
        domain: String(row._id),
        count: row.count,
        approved: row.approved,
      })),

    districtBreakdown: (result?.districtBreakdown ?? [])
      .map((row:any) => ({
        district: String(row._id.district),
        state: String(row._id.state),
        count: row.count,
        approved: row.approved,
      })),
  };
}

async getQuestionStats(): Promise<{
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}> {
  const [result] = await this._model.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },

        approved: {
          $sum: {
            $cond: [
              { $eq: ['$status', QuestionStatus.APPROVED] },
              1,
              0,
            ],
          },
        },

        rejected: {
          $sum: {
            $cond: [
              { $eq: ['$status', QuestionStatus.REJECTED] },
              1,
              0,
            ],
          },
        },

        pending: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [QuestionStatus.PENDING, QuestionStatus.HELD],
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return (
    result ?? {
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
    }
  );
}

async countSubmittedBetween(
  from: Date,
  to: Date,
): Promise<number> {
  return this._model.countDocuments({
    submittedAt: {
      $gte: from,
      $lte: to,
    },
  });
}

async getDailyStatsSince(
  from: Date,
): Promise<
  Array<{
    date: string;
    users: number;
    questions: number;
    approved: number;
    rejected: number;
  }>
> {
  return this._model.aggregate([
    {
      $match: {
        submittedAt: {
          $gte: from,
        },
      },
    },

    // First group by date + user.
    // This allows us to reproduce SQL's COUNT(DISTINCT userId).
    {
      $group: {
        _id: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$submittedAt',
            },
          },
          userId: '$userId',
        },

        questions: {
          $sum: 1,
        },

        approved: {
          $sum: {
            $cond: [
              { $eq: ['$status', QuestionStatus.APPROVED] },
              1,
              0,
            ],
          },
        },

        rejected: {
          $sum: {
            $cond: [
              { $eq: ['$status', QuestionStatus.REJECTED] },
              1,
              0,
            ],
          },
        },
      },
    },

    // Then group again by date.
    {
      $group: {
        _id: '$_id.date',

        // Each document from the previous stage represents
        // one unique user for that date.
        users: {
          $sum: 1,
        },

        questions: {
          $sum: '$questions',
        },

        approved: {
          $sum: '$approved',
        },

        rejected: {
          $sum: '$rejected',
        },
      },
    },

    {
      $project: {
        _id: 0,
        date: '$_id',
        users: 1,
        questions: 1,
        approved: 1,
        rejected: 1,
      },
    },

    {
      $sort: {
        date: 1,
      },
    },
  ]);
}
}