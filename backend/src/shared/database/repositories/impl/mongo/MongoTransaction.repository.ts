import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { lookupByStringId } from '../../../abstractions/mongo-utils';
import {
  ITransactionRepository,
  RewardAnalyticsResult,
  RewardTransactionSummary,
  TransactionBySourceOptions,
  TransactionListOptions,
  WalletTransactionSummary,
} from '../../ITransaction.repository';
// import { Transaction } from '../../../entities';
import { TransactionSource, TransactionStatus, TransactionType } from '@/shared/classes/enums';
import { Transaction } from '@/shared/database/mongodb/schemas/transaction.schema';
@Injectable()
export class MongoTransactionRepository
  extends MongoRepository<Transaction>
  implements ITransactionRepository
{
  constructor(@InjectModel('Transaction') protected readonly _model: Model<Transaction>) {
    super(_model);
  }

  async findByWalletId(walletId: string, limit?: number): Promise<Transaction[]> {
    const q = this._model.find({ walletId } as Record<string, unknown>).sort({ createdAt: -1 });
    if (limit) q.limit(limit);
    return q.exec() as Promise<Transaction[]>;
  }

  async findByReferenceId(referenceId: string): Promise<Transaction | null> {
    return this._model
      .findOne({ referenceId } as Record<string, unknown>)
      .exec() as Promise<Transaction | null>;
  }

  async getWalletSummary(walletId: string): Promise<WalletTransactionSummary> {
    // Amounts may be stored as numbers, strings or Decimal128, and type/status
    // casing can vary, so normalise both before summing.
    const amount = { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } };
    const sumOf = (type: TransactionType, completedOnly = false) => ({
      $sum: {
        $cond: [
          {
            $and: [
              { $eq: [{ $toLower: { $ifNull: ['$type', ''] } }, type] },
              ...(completedOnly
                ? [{ $eq: [{ $toLower: { $ifNull: ['$status', ''] } }, TransactionStatus.COMPLETED] }]
                : []),
            ],
          },
          amount,
          0,
        ],
      },
    });

    const [r] = await this._model
      .aggregate([
        { $match: { walletId } },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalCredits: sumOf(TransactionType.CREDIT),
            totalDebits: sumOf(TransactionType.DEBIT),
            completedCredits: sumOf(TransactionType.CREDIT, true),
            completedDebits: sumOf(TransactionType.DEBIT, true),
            withdrawalCount: {
              $sum: {
                $cond: [
                  { $eq: [{ $toLower: { $ifNull: ['$source', ''] } }, TransactionSource.WITHDRAWAL] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
      .exec();

    return {
      totalCount: Number(r?.totalCount ?? 0),
      totalCredits: Number(r?.totalCredits ?? 0),
      totalDebits: Number(r?.totalDebits ?? 0),
      completedCredits: Number(r?.completedCredits ?? 0),
      completedDebits: Number(r?.completedDebits ?? 0),
      withdrawalCount: Number(r?.withdrawalCount ?? 0),
    };
  }

  async getRewardAnalytics(
    from: Date,
    to: Date,
    state?: string,
    walletIdFilter?: Record<string, unknown>,
  ): Promise<RewardAnalyticsResult> {
    const completedRewards = {
      source: TransactionSource.REWARD,
      status: TransactionStatus.COMPLETED,
      ...(walletIdFilter ? { walletId: walletIdFilter } : {}),
    };

    // walletId / wallet.userId are stored as strings, so compare against stringified _id.
    const stateFilter = state
      ? [
          {
            $lookup: {
              from: 'wallets',
              let: { wid: '$walletId' },
              pipeline: [{ $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$wid'] } } }],
              as: 'wallet',
            },
          },
          { $unwind: '$wallet' },
          {
            $lookup: {
              from: 'users',
              let: { uid: '$wallet.userId' },
              pipeline: [{ $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$uid'] } } }],
              as: 'user',
            },
          },
          { $unwind: '$user' },
          { $match: { 'user.state': state } },
        ]
      : [];

    const [result] = await this._model
      .aggregate([
        { $match: completedRewards },
        {
          $facet: {
            totalPool: [{ $group: { _id: null, total: { $sum: '$amount' } } }],
            daily: [
              { $match: { createdAt: { $gte: from, $lte: to } } },
              ...stateFilter,
              {
                $group: {
                  _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                  amount: { $sum: '$amount' },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: 1 } },
            ],
          },
        },
      ])
      .exec();

    const dailyRewardTrend: RewardAnalyticsResult['dailyRewardTrend'] = (result?.daily ?? []).map(
      (r: { _id: string; amount: number; count: number }) => ({
        date: r._id,
        amount: r.amount,
        count: r.count,
      }),
    );
    const totalRewarded = dailyRewardTrend.reduce((s, r) => s + r.amount, 0);
    const rewardCount = dailyRewardTrend.reduce((s, r) => s + r.count, 0);

    return {
      totalRewarded,
      rewardCount,
      avgReward: rewardCount > 0 ? totalRewarded / rewardCount : 0,
      totalPool: Number(result?.totalPool?.[0]?.total ?? 0),
      dailyRewardTrend,
    };
  }

  async getRewardSummary(
  from: Date,
  to: Date,
  state?: string,
): Promise<RewardTransactionSummary> {
  const [result] = await this._model.aggregate([
    {
      $match: {
        source: TransactionSource.REWARD,
        status: 'completed',
        createdAt: {
          $gte: from,
          $lte: to,
        },
      },
    },

    // Transaction -> Wallet
    {
      $lookup: {
        from: 'wallets',
        localField: 'walletId',
        foreignField: '_id',
        as: 'wallet',
      },
    },

    {
      $unwind: '$wallet',
    },

    // Wallet -> User
    {
      $lookup: {
        from: 'users',
        localField: 'wallet.userId',
        foreignField: '_id',
        as: 'user',
      },
    },

    {
      $unwind: '$user',
    },

    // Optional state filter
    ...(state
      ? [
          {
            $match: {
              'user.state': state,
            },
          },
        ]
      : []),

    {
      $group: {
        _id: null,

        totalRewarded: {
          $sum: '$amount',
        },

        rewardCount: {
          $sum: 1,
        },

        avgReward: {
          $avg: '$amount',
        },
      },
    },

    {
      $project: {
        _id: 0,
        totalRewarded: 1,
        rewardCount: 1,
        avgReward: 1,
      },
    },
  ]);

  return {
    totalRewarded: Number(result?.totalRewarded ?? 0),
    rewardCount: Number(result?.rewardCount ?? 0),
    avgReward: Number(result?.avgReward ?? 0),
  };
}

  async findRewardsForExport(filters: {
    from: Date;
    to: Date;
    state?: string;
  }): Promise<Record<string, unknown>[]> {
    const { from, to, state } = filters;
    return this._model
      .aggregate([
        { $match: { source: TransactionSource.REWARD, createdAt: { $gte: from, $lte: to } } },
        { $sort: { createdAt: -1 } },
        ...lookupByStringId('wallets', 'walletId', 'w'),
        ...lookupByStringId('users', 'w.userId', 'u'),
        ...(state ? [{ $match: { 'u.state': state } }] : []),
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            mobileNumber: '$u.mobileNumber',
            name: '$u.name',
            amount: 1,
            type: 1,
            source: 1,
            description: 1,
            status: 1,
            referenceId: 1,
            createdAt: 1,
          },
        },
      ])
      .exec();
  }

  async findPaginatedByWalletId(
  walletId: string,
  page: number,
  limit: number,
  options: TransactionListOptions = {},
): Promise<{ items: Transaction[]; total: number }> {
  const {
    type, status, source, fromDate, toDate,
    sortBy = 'createdAt', sortOrder = 'DESC', select,
  } = options;

  const filter: Record<string, unknown> = { walletId };
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (source) filter.source = source;
  if (fromDate || toDate) {
    filter.createdAt = {
      ...(fromDate && { $gte: fromDate }),
      ...(toDate && { $lte: toDate }),
    };
  }

  const dir = sortOrder === 'ASC' ? 1 : -1;
  // _id as a tiebreaker keeps pagination stable when many rows share the same value
  const sort: Record<string, 1 | -1> = { [sortBy]: dir, _id: dir };

  let query = this._model.find(filter);
  if (select) query = query.select(select);

  const [docs, total] = await Promise.all([
    query.sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
    this._model.countDocuments(filter).exec(),
  ]);

  const items = docs.map((d) => ({ ...d, id: d._id.toString() })) as unknown as Transaction[];
  return { items, total };
}

async getEarnedAndWithdrawn(
  walletId: string,
): Promise<{ totalEarned: number; totalWithdrawn: number }> {
  const [result] = await this._model.aggregate([
    {
      $match: {
        // use new Types.ObjectId(walletId) here if the schema stores walletId as ObjectId
        walletId,
        status: TransactionStatus.COMPLETED,
      },
    },
    {
      $group: {
        _id: null,
        totalEarned: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$type', TransactionType.CREDIT] },
                  { $in: ['$source', [TransactionSource.REWARD, TransactionSource.REFUND]] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
        totalWithdrawn: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$type', TransactionType.DEBIT] },
                  { $eq: ['$source', TransactionSource.WITHDRAWAL] },
                ],
              },
              '$amount',
              0,
            ],
          },
        },
      },
    },
  ]);

  return {
    totalEarned: Number(result?.totalEarned ?? 0),
    totalWithdrawn: Number(result?.totalWithdrawn ?? 0),
  };
}

async findBySource(
  source: string,
  options: TransactionBySourceOptions,
): Promise<Transaction[]> {
  const { fromDate, toDate, walletIds, limit = 100, select } = options;

  const filter: Record<string, unknown> = {
    source,
    createdAt: { $gte: fromDate, $lte: toDate }, // BETWEEN is inclusive
  };
  if (walletIds) filter.walletId = { $in: walletIds };

  let query = this._model.find(filter);
  if (select) query = query.select(select);

  const docs = await query
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec();

  return docs.map((d) => ({ ...d, id: d._id.toString() })) as unknown as Transaction[];
}


}
