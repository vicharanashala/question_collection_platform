import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import {
  ITransactionRepository,
  RewardAnalyticsResult,
  RewardTransactionSummary,
} from '../../ITransaction.repository';
import { Transaction } from '../../../entities';
import { TransactionSource, TransactionStatus } from '@/shared/classes/enums';

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

  async getRewardAnalytics(
    from: Date,
    to: Date,
    state?: string,
  ): Promise<RewardAnalyticsResult> {
    const completedRewards = {
      source: TransactionSource.REWARD,
      status: TransactionStatus.COMPLETED,
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
}