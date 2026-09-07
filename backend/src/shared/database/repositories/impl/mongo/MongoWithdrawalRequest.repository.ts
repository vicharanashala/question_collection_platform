import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IWithdrawalRequestRepository, ListWithdrawalsOptions, ListWithdrawalsResult, WithdrawalFinancialSummary, WithdrawalRewardSummary } from '../../IWithdrawalRequest.repository';
import { WithdrawalRequest } from '../../../entities';
import { TransactionType, WithdrawalStatus } from '../../../../classes/enums';

@Injectable()
export class MongoWithdrawalRequestRepository
  extends MongoRepository<WithdrawalRequest>
  implements IWithdrawalRequestRepository
{
  constructor(@InjectModel('WithdrawalRequest') protected readonly _model: Model<WithdrawalRequest>) {
    super(_model);
  }

  async findPendingByUserId(userId: string): Promise<WithdrawalRequest | null> {
    return this._model
      .findOne({ userId, status: WithdrawalStatus.PENDING } as Record<string, unknown>)
      .exec() as Promise<WithdrawalRequest | null>;
  }

  async findByWalletId(walletId: string): Promise<WithdrawalRequest[]> {
    return this._model
      .find({ walletId } as Record<string, unknown>)
      .sort({ createdAt: -1 })
      .exec() as Promise<WithdrawalRequest[]>;
  }

  async findByStatus(status: WithdrawalStatus): Promise<WithdrawalRequest[]> {
    return this._model
      .find({ status } as Record<string, unknown>)
      .exec() as Promise<WithdrawalRequest[]>;
  }

  async getFinancialSummary(
  since: Date,
  todayStart: Date,
  now: Date,
): Promise<WithdrawalFinancialSummary> {
  const [result] = await this._model.aggregate([
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,

              totalPaidOut: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        '$status',
                        WithdrawalStatus.COMPLETED,
                      ],
                    },
                    '$amount',
                    0,
                  ],
                },
              },

              pendingWithdrawalCount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        '$status',
                        WithdrawalStatus.PENDING,
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              pendingWithdrawalAmount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        '$status',
                        WithdrawalStatus.PENDING,
                      ],
                    },
                    '$amount',
                    0,
                  ],
                },
              },

              completedWithdrawalCount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        '$status',
                        WithdrawalStatus.COMPLETED,
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              completedWithdrawalAmount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        '$status',
                        WithdrawalStatus.COMPLETED,
                      ],
                    },
                    '$amount',
                    0,
                  ],
                },
              },

              failedWithdrawalCount: {
                $sum: {
                  $cond: [
                    {
                      $eq: [
                        '$status',
                        WithdrawalStatus.FAILED,
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

        today: [
          {
            $match: {
              status: WithdrawalStatus.COMPLETED,
              processedAt: {
                $gte: todayStart,
                $lte: now,
              },
            },
          },
          {
            $group: {
              _id: null,

              payoutCount: {
                $sum: 1,
              },

              payoutAmount: {
                $sum: '$amount',
              },
            },
          },
        ],

        dailyPayoutTrend: [
          {
            $match: {
              status: WithdrawalStatus.COMPLETED,
              processedAt: {
                $gte: since,
                $lte: now,
              },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$processedAt',
                },
              },

              count: {
                $sum: 1,
              },

              amount: {
                $sum: '$amount',
              },
            },
          },
          {
            $project: {
              _id: 0,
              date: '$_id',
              count: 1,
              amount: 1,
            },
          },
          {
            $sort: {
              date: 1,
            },
          },
        ],
      },
    },
  ]);

  const summary = result?.summary?.[0] ?? {};
  const today = result?.today?.[0] ?? {};

  return {
    totalPaidOut: Number(summary.totalPaidOut ?? 0),

    pendingWithdrawals: {
      count: Number(summary.pendingWithdrawalCount ?? 0),
      amount: Number(summary.pendingWithdrawalAmount ?? 0),
    },

    completedWithdrawals: {
      count: Number(summary.completedWithdrawalCount ?? 0),
      amount: Number(summary.completedWithdrawalAmount ?? 0),
    },

    failedWithdrawals: {
      count: Number(summary.failedWithdrawalCount ?? 0),
    },

    today: {
      payoutCount: Number(today.payoutCount ?? 0),
      payoutAmount: Number(today.payoutAmount ?? 0),
    },

    dailyPayoutTrend: (result?.dailyPayoutTrend ?? []).map(
      (item: any) => ({
        date: item.date,
        count: Number(item.count ?? 0),
        amount: Number(item.amount ?? 0),
      }),
    ),
  };
}

async getRewardSummary(
  from: Date,
  to: Date,
): Promise<WithdrawalRewardSummary> {
  const [result] = await this._model.aggregate([
    {
      $match: {
        createdAt: {
          $gte: from,
          $lte: to,
        },
      },
    },

    {
      $group: {
        _id: null,

        totalWithdrawn: {
          $sum: '$amount',
        },

        withdrawalCount: {
          $sum: 1,
        },

        pendingWithdrawals: {
          $sum: {
            $cond: [
              {
                $eq: [
                  '$status',
                  WithdrawalStatus.PENDING,
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        totalWithdrawn: 1,
        withdrawalCount: 1,
        pendingWithdrawals: 1,
      },
    },
  ]);

  return {
    totalWithdrawn: Number(result?.totalWithdrawn ?? 0),
    withdrawalCount: Number(result?.withdrawalCount ?? 0),
    pendingWithdrawals: Number(
      result?.pendingWithdrawals ?? 0,
    ),
  };
}

async listWithdrawals(
  options: ListWithdrawalsOptions,
): Promise<ListWithdrawalsResult> {
  const {
    page,
    limit,
    status,
    state,
    search,
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    fromDate,
    toDate,
    filterStatus,
  } = options;

  const skip = (page - 1) * limit;

  const match: Record<string, unknown> = {};

  if (status) {
    match.status = status;
  }

  if (fromDate || toDate) {
    match.createdAt = {
      ...(fromDate ? { $gte: fromDate } : {}),
      ...(toDate ? { $lte: toDate } : {}),
    };
  }

  const sortField =
    sortBy === 'amount'
      ? 'amount'
      : sortBy === 'processedAt'
        ? 'processedAt'
        : 'createdAt';

  const sortDirection = sortOrder === 'ASC' ? 1 : -1;

  const pipeline: any[] = [
    {
      $match: match,
    },

    // Withdrawal -> User
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },

    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true,
      },
    },
  ];

  // State filter
  if (state) {
    pipeline.push({
      $match: {
        'user.state': state,
      },
    });
  }

  // Search by user name/mobile
  if (search) {
    const escapedSearch = search.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );

    pipeline.push({
      $match: {
        $or: [
          {
            'user.name': {
              $regex: escapedSearch,
              $options: 'i',
            },
          },
          {
            'user.mobileNumber': {
              $regex: escapedSearch,
              $options: 'i',
            },
          },
        ],
      },
    });
  }

  // Withdrawal -> Debit Transaction
  pipeline.push({
    $lookup: {
      from: 'transactions',
      let: {
        withdrawalId: '$_id',
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: [
                    '$referenceId',
                    {
                      $toString: '$$withdrawalId',
                    },
                  ],
                },
                {
                  $eq: [
                    '$type',
                    TransactionType.DEBIT,
                  ],
                },
              ],
            },
          },
        },
        {
          $project: {
            rejectionReason: 1,
          },
        },
        {
          $limit: 1,
        },
      ],
      as: 'transaction',
    },
  });

  // failed_pending_tx filter
  if (filterStatus === 'failed_pending_tx') {
    pipeline.push({
      $match: {
        status: 'failed',
        transaction: {
          $size: 0,
        },
      },
    });
  }

  // Pagination + total
  pipeline.push({
    $facet: {
      items: [
        {
          $sort: {
            [sortField]: sortDirection,
          },
        },

        {
          $skip: skip,
        },

        {
          $limit: limit,
        },

        {
          $project: {
            _id: 0,
            id: {
              $toString: '$_id',
            },
            amount: 1,
            payoutMethod: 1,
            payoutDetails: 1,
            status: 1,
            createdAt: 1,
            processedAt: 1,
            pinelabsTransactionId: 1,
            orderId: 1,

            rejectionReason: {
              $ifNull: [
                {
                  $arrayElemAt: [
                    '$transaction.rejectionReason',
                    0,
                  ],
                },
                null,
              ],
            },

            user: {
              $cond: [
                {
                  $ne: ['$user', null],
                },
                {
                  id: {
                    $toString: '$user._id',
                  },
                  name: '$user.name',
                  mobileNumber: '$user.mobileNumber',
                  state: '$user.state',
                },
                null,
              ],
            },
          },
        },
      ],

      total: [
        {
          $count: 'count',
        },
      ],
    },
  });

  const [result] = await this._model.aggregate(pipeline);

  return {
    items: result?.items ?? [],
    total: result?.total?.[0]?.count ?? 0,
  };
}

}