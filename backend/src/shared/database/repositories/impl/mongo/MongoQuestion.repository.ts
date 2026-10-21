import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import {
  DailyVolumeRow,
  IQuestionRepository,
  QuestionAnalyticsFilters,
  QuestionAnalyticsResult, UserQuestionCounts } from '../../IQuestion.repository';
import { Question } from '../../../entities';
import { QuestionStatus } from '../../../../classes/enums';
import { mongoLike, escapeRegex, lookupByStringId } from '../../../abstractions/mongo-utils';
import { ListQuestionsDto } from '@/modules/question/dto';
import { ListReviewQueueDto } from '@/modules/admin/dto/review-question.dto';
import { userIdTesterCondition, type TesterFilter } from '../../../../utils/tester.util';

/** Distributed questions (moved_to_final) were approved first, so they count as approved. */
const APPROVED_STATUSES = [QuestionStatus.APPROVED, QuestionStatus.MOVED_TO_FINAL];

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
    state?: string,
    district?: string,
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

  async countSubmissionsByUsers(userIds: string[]): Promise<UserQuestionCounts[]> {
    if (userIds.length === 0) return [];
    const rows = await this._model
      .aggregate<{ _id: string; questions: number; answers: number }>([
        { $match: { userId: { $in: userIds } } },
        {
          $group: {
            _id: '$userId',
            questions: { $sum: 1 },
            answers: { $sum: { $cond: [{ $eq: ['$isAnswerSubmitted', true] }, 1, 0] } },
          },
        },
      ])
      .exec();
    return rows.map((r) => ({ userId: r._id, questions: r.questions, answers: r.answers }));
  }

  async findUserIdsWithAnswers(minAnswers: number): Promise<string[]> {
    const rows = await this._model
      .aggregate<{ _id: string }>([
        { $match: { isAnswerSubmitted: true } },
        { $group: { _id: '$userId', answers: { $sum: 1 } } },
        { $match: { answers: { $gte: minAnswers } } },
      ])
      .exec();
    return rows.map((r) => r._id);
  }

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

  async dailyVolume(
  from: Date,
  to: Date,
  filter: Record<string, unknown>,
): Promise<DailyVolumeRow[]> {
  const rows = await this._model
    .aggregate<{
      _id: string;
      submitted: number;
      approved: number;
      rejected: number;
      held: number;
    }>([
      {
        $match: {
          ...filter, // state / cropType
          submittedAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$submittedAt',
              timezone: 'Asia/Kolkata',
            },
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

  async topField(
  field: 'cropType' | 'state',
  from: Date,
  to: Date,
  filter: Record<string, unknown>,
  limit: number,
): Promise<Array<{ key: string; count: number }>> {
  const rows = await this._model
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          ...filter, // state / cropType
          submittedAt: { $gte: from, $lte: to },
          // Drop empty values in the DB so they don't eat into $limit.
          [field]: { $nin: [null, ''] },
        },
      },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limit },
    ])
    .exec();

  return rows.map((r) => ({ key: String(r._id), count: r.count }));
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

  async topDomains(
  from: Date,
  to: Date,
  filter: Record<string, unknown>,
  limit: number,
): Promise<Array<{ domain: string; count: number }>> {
  const rows = await this._model
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          $and: [filter, { submittedAt: { $gte: from, $lte: to } }],
        },
      },
      { $unwind: '$domains' },
      // Drop empty values here so they don't eat into $limit.
      { $match: { domains: { $nin: [null, ''] } } },
      { $group: { _id: '$domains', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limit },
    ])
    .exec();

  return rows.map((r) => ({ domain: String(r._id), count: r.count }));
}

  async countDistinctStates(
    from: Date,
    to: Date,
    statuses: QuestionStatus[],
    userIdFilter?: Record<string, unknown>,
  ): Promise<number> {
    const states = await this._model
      .distinct('state', {
        ...(userIdFilter ? { userId: userIdFilter } : {}),
        status: { $in: statuses },
        submittedAt: { $gte: from, $lte: to },
        state: { $nin: [null, ''] },
      })
      .exec();
    return states.length;
  }

  async avgReviewTurnaroundMinutesSince(
    from: Date,
    statuses: QuestionStatus[],
    userIdFilter?: Record<string, unknown>,
  ): Promise<number | null> {
    if (statuses.length === 0) return null;
    const row = await this._model
      .aggregate<{ avgMs: number | null }>([
        {
          $match: {
            ...(userIdFilter ? { userId: userIdFilter } : {}),
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


  async avgReviewTurnaroundMinutes(
  from: Date,
  to: Date,
  filter: Record<string, unknown>,
  statuses: QuestionStatus[],
): Promise<number | null> {
  if (statuses.length === 0) return null;

  const row = await this._model
    .aggregate<{ avgMs: number | null }>([
      {
        $match: {
          ...filter, // state / cropType, plain equality
          reviewedAt: { $ne: null, $gte: from, $lte: to },
          submittedAt: { $ne: null },
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
  const { from, to, state, cropType, userIdFilter } = filters;

  const match: Record<string, unknown> = {
    submittedAt: {
      $gte: from,
      $lte: to,
    },
  };

  if (userIdFilter) {
    match.userId = userIdFilter;
  }

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
                    { $in: ['$status', APPROVED_STATUSES] },
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
                    { $in: ['$status', APPROVED_STATUSES] },
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
                    { $in: ['$status', APPROVED_STATUSES] },
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
                    { $in: ['$status', APPROVED_STATUSES] },
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
                    { $in: ['$status', APPROVED_STATUSES] },
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
                    { $in: ['$status', APPROVED_STATUSES] },
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

async getQuestionStats(userIdFilter?: Record<string, unknown>): Promise<{
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}> {
  const [result] = await this._model.aggregate([
    ...(userIdFilter ? [{ $match: { userId: userIdFilter } }] : []),
    {
      $group: {
        _id: null,
        total: { $sum: 1 },

        approved: {
          $sum: {
            $cond: [
              { $in: ['$status', APPROVED_STATUSES] },
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
  userIdFilter?: Record<string, unknown>,
): Promise<number> {
  return this._model.countDocuments({
    ...(userIdFilter ? { userId: userIdFilter } : {}),
    submittedAt: {
      $gte: from,
      $lte: to,
    },
  });
}

async getDailyStatsSince(
  from: Date,
  userIdFilter?: Record<string, unknown>,
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
        ...(userIdFilter ? { userId: userIdFilter } : {}),
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
              { $in: ['$status', APPROVED_STATUSES] },
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

  async findForExport(filters: {
    from: Date;
    to: Date;
    state?: string;
    cropType?: string;
  }): Promise<Record<string, unknown>[]> {
    const { from, to, state, cropType } = filters;
    return this._model
      .aggregate([
        {
          $match: {
            submittedAt: { $gte: from, $lte: to },
            ...(state ? { state } : {}),
            ...(cropType ? { cropType } : {}),
          },
        },
        { $sort: { submittedAt: -1 } },
        ...lookupByStringId('users', 'userId', 'u'),
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            mobileNumber: '$u.mobileNumber',
            name: '$u.name',
            questionText: 1,
            language: 1,
            domains: 1,
            cropType: 1,
            season: 1,
            state: 1,
            district: 1,
            mediaType: 1,
            status: 1,
            submittedAt: 1,
            reviewedAt: 1,
            rejectionReason: 1,
            heldReason: 1,
            approvalReason: 1,
          },
        },
      ])
      .exec();
  }

  // Lists questions with submitter and reviewer details. Staff see every question; users see only their own.
  async list(
    userId: string,
    dto: ListQuestionsDto,
    isAdmin = false,
    canViewContact = false,
  ) {
    const {
      page = 1,
      limit = 20,
      status,
      domains,
      cropType,
      season,
      state,
      search,
      fromDate,
      toDate,
      answerStatus,
      userType,
    } = dto;

    const match: Record<string, unknown> = {};

    // Access control
    if (!isAdmin) match.userId = userId;
    else await this.applyTesterFilter(match, dto.tester);
    if (status) match.status = status;
    if (domains) match.domains = domains;
    if (cropType) match.cropType = { $regex: escapeRegex(cropType), $options: 'i' };
    if (season) match.season = season;
    if (state) match.state = state;

    const submittedAt = buildDateRange(fromDate, toDate);
    if (submittedAt) match.submittedAt = submittedAt;

    const searchCondition = buildSearchCondition(search);
    if (searchCondition) match.$or = searchCondition;

    const staffConditions = buildStaffConditions(scopeToUserType(dto.anveshanScope) ?? userType, answerStatus);
    if (isAdmin && dto.userIds?.length) staffConditions.push({ userId: { $in: dto.userIds } });
    if (staffConditions.length > 0) match.$and = staffConditions;

    return this.paginateWithUsers(match, { submittedAt: -1 }, page, limit, canViewContact);
  }

  // Lists the review queue (pending and held by default) with submitter details, including contact number.
  async listQueue(dto: ListReviewQueueDto) {
    const {
      page = 1,
      limit = 20,
      state,
      search,
      status,
      sortBy = 'submittedAt',
      sortOrder = 'DESC',
      fromDate,
      toDate,
      userType,
    } = dto;

    const match: Record<string, unknown> = {
      status: { $in: status?.length ? status : [QuestionStatus.PENDING, QuestionStatus.HELD] },
    };
    if (state) match.state = state;
    await this.applyTesterFilter(match, dto.tester);

    const submittedAt = buildDateRange(fromDate, toDate);
    if (submittedAt) match.submittedAt = submittedAt;

    const searchCondition = buildSearchCondition(search);
    if (searchCondition) match.$or = searchCondition;

    const staffConditions = buildStaffConditions(scopeToUserType(dto.anveshanScope) ?? userType);
    if (staffConditions.length > 0) match.$and = staffConditions;

    const direction = sortOrder === 'ASC' ? 1 : -1;
    const sortField = QUEUE_SORT_FIELDS[sortBy] ?? 'submittedAt';
    return this.paginateWithUsers(match, { [sortField]: direction, _id: direction }, page, limit, true);
  }

  // Limits the match to tester or non-tester submitters when a tester filter is set.
  private async applyTesterFilter(match: Record<string, unknown>, tester?: TesterFilter): Promise<void> {
    if (!tester) return;
    const testers = await this._model.db
      .collection('users')
      .find({ is_tester: true }, { projection: { _id: 1 } })
      .toArray();
    match.userId = userIdTesterCondition(tester, testers.map((doc) => String(doc._id)));
  }

  // Runs one aggregation that returns a page of questions with submitter and reviewer details plus the total count.
  private async paginateWithUsers(
    match: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    page: number,
    limit: number,
    canViewContact: boolean,
  ) {
    const userFields: Record<string, 0 | 1> = { _id: 0, name: 1, username: 1, isAnveshanUser: 1, is_tester: 1 };
    if (canViewContact) userFields.mobileNumber = 1;

    const result = await this._model.aggregate([
      { $match: match },
      {
        $facet: {
          items: [
            { $sort: sort },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            lookupUserByStringId('$userId', 'user', userFields),
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            lookupUserByStringId('$reviewerId', 'reviewerUser', { _id: 0, name: 1 }),
            { $unwind: { path: '$reviewerUser', preserveNullAndEmptyArrays: true } },
            {
              $lookup: {
                from: 'anveshan_answers',
                let: { questionId: { $toString: '$_id' } },
                pipeline: [
                  { $match: { $expr: { $eq: ['$questionId', '$$questionId'] } } },
                  { $limit: 1 },
                  { $project: { _id: 1 } },
                ],
                as: 'answerRecord',
              },
            },
            {
              $project: {
                _id: 1,
                userId: 1,
                question: 1,
                questionText: 1,
                status: 1,
                domains: 1,
                cropType: 1,
                season: 1,
                state: 1,
                district: 1,
                block: 1,
                language: 1,
                mediaType: 1,
                mediaUrls: 1,
                audioUrls: 1,
                duplicateFlag: 1,
                submissionLocation: 1,
                isAnveshan: 1,
                // True when an answer record exists in anveshan_answers.
                isAnswerSubmitted: { $gt: [{ $size: '$answerRecord' }, 0] },
                submittedAt: 1,
                createdAt: 1,
                updatedAt: 1,
                user: 1,
                reviewedByName: { $ifNull: ['$reviewerUser.name', null] },
                answer: 1,
                response: 1,
                reviewedAt: 1,
                rejectionReason: 1,
                approvalReason: 1,
                heldReason: 1,
              },
            },
          ],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    // Expose _id as id so list items match every other question endpoint.
    const items = (result[0]?.items ?? []).map(
      ({ _id, user, ...rest }: { _id: unknown; user?: Record<string, unknown> } & Record<string, unknown>) => {
        const { is_tester: isTester, ...userFields } = user ?? {};
        return {
          ...rest,
          id: String(_id),
          user: user ? { ...userFields, id: String(rest.userId), isTester: !!isTester } : null,
        };
      },
    );
    const total = result[0]?.total?.[0]?.count ?? 0;

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
}

/** Review queue sort options mapped to question fields. */
const QUEUE_SORT_FIELDS: Record<string, string> = {
  submittedAt: 'submittedAt',
  state: 'state',
  reviewedAt: 'reviewedAt',
  createdAt: 'createdAt',
};

// Builds a submittedAt range from optional ISO dates, or undefined when neither is set.
function buildDateRange(fromDate?: string, toDate?: string): Record<string, Date> | undefined {
  if (!fromDate && !toDate) return undefined;
  return {
    ...(fromDate ? { $gte: new Date(fromDate) } : {}),
    ...(toDate ? { $lte: new Date(toDate) } : {}),
  };
}

// Builds a case-insensitive match across the question text, crop and location fields.
function buildSearchCondition(search?: string): Record<string, unknown>[] | undefined {
  const term = search?.trim();
  if (!term) return undefined;
  const regex = { $regex: escapeRegex(term), $options: 'i' };
  return [{ questionText: regex }, { cropType: regex }, { state: regex }, { district: regex }];
}

// Maps the user-type and answer-status filters to question conditions. Anveshan is read from the question flag.
// Maps the staff Anveshan mode to the existing user type filter.
function scopeToUserType(scope?: 'only' | 'exclude'): 'anveshan' | 'regular' | undefined {
  if (!scope) return undefined;
  return scope === 'only' ? 'anveshan' : 'regular';
}

function buildStaffConditions(
  userType?: 'anveshan' | 'regular',
  answerStatus?: 'answered' | 'unanswered',
): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];
  if (userType === 'anveshan') conditions.push({ isAnveshan: true });
  if (userType === 'regular') conditions.push({ isAnveshan: { $ne: true } });
  if (answerStatus === 'answered') conditions.push({ isAnswerSubmitted: true });
  if (answerStatus === 'unanswered') {
    conditions.push({ isAnveshan: true }, { isAnswerSubmitted: { $ne: true } });
  }
  return conditions;
}

// Joins a users document onto each question using a string user id field.
function lookupUserByStringId(idField: string, as: string, projection: Record<string, 0 | 1>) {
  return {
    $lookup: {
      from: 'users',
      let: { userObjectId: { $convert: { input: idField, to: 'objectId', onError: null, onNull: null } } },
      pipeline: [
        { $match: { $expr: { $eq: ['$_id', '$$userObjectId'] } } },
        { $project: projection },
      ],
      as,
    },
  };
}
