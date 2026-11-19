import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, PipelineStage, Types } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import {
  AdminWalletPageOptions,
  AdminWalletRow,
  AdminWalletScope,
  AdminWalletTotals,
  IWalletRepository,
} from '../../IWallet.repository';
// import { Wallet } from '../../../entities';
import { mongoLike, mongoNe, toMongoFilter } from '../../../abstractions/mongo-utils';
import { Wallet } from '@/shared/database/mongodb/schemas/wallet.schema';
import { TransactionSource, TransactionStatus, TransactionType } from '@/shared/classes/enums';

const NOT_DELETED = mongoNe(true);

// 'only' keeps owners with the flag set, 'exclude' keeps everyone else.
function ownerFlagCondition(scope: 'only' | 'exclude'): unknown {
  return scope === 'only' ? true : NOT_DELETED;
}

/**
 * Keeps only the wallets in scope and attaches each wallet's owner as `owner`.
 * The list and the totals both start from these stages, so they always cover the same wallets.
 */
export function walletScopeStages(scope: AdminWalletScope): PipelineStage[] {
  const ownerMatch: Record<string, unknown> = { 'owner.isDeleted': NOT_DELETED };
  if (scope.state) ownerMatch['owner.state'] = scope.state;
  if (scope.search) {
    const pattern = mongoLike(scope.search);
    ownerMatch.$or = [{ 'owner.name': pattern }, { 'owner.mobileNumber': pattern }];
  }
  if (scope.tester) ownerMatch['owner.is_tester'] = ownerFlagCondition(scope.tester);
  if (scope.anveshanScope) ownerMatch['owner.isAnveshanUser'] = ownerFlagCondition(scope.anveshanScope);

  return [
    { $match: { isDeleted: NOT_DELETED, ...(scope.userId ? { userId: scope.userId } : {}) } },
    // userId is stored as a string; matching it as an ObjectId lets the join use the users _id index.
    { $addFields: { ownerObjectId: { $convert: { input: '$userId', to: 'objectId', onError: null, onNull: null } } } },
    { $lookup: { from: 'users', localField: 'ownerObjectId', foreignField: '_id', as: 'owner' } },
    // Wallets whose user no longer exists drop out here.
    { $unwind: '$owner' },
    { $match: ownerMatch },
  ];
}

// Adds totalEarned (completed reward credits) and totalWithdrawn (completed withdrawal debits) to each wallet.
const TRANSACTION_TOTALS_STAGES: [PipelineStage.Lookup, PipelineStage.AddFields] = [
  {
    $lookup: {
      from: 'transactions',
      let: { walletId: { $toString: '$_id' } },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$walletId', '$$walletId'] },
            status: TransactionStatus.COMPLETED,
            isDeleted: NOT_DELETED,
          },
        },
        {
          $group: {
            _id: null,
            earned: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$type', TransactionType.CREDIT] }, { $eq: ['$source', TransactionSource.REWARD] }] },
                  '$amount',
                  0,
                ],
              },
            },
            withdrawn: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$type', TransactionType.DEBIT] }, { $eq: ['$source', TransactionSource.WITHDRAWAL] }] },
                  '$amount',
                  0,
                ],
              },
            },
          },
        },
      ],
      as: 'transactionTotals',
    },
  },
  {
    $addFields: {
      totalEarned: { $ifNull: [{ $arrayElemAt: ['$transactionTotals.earned', 0] }, 0] },
      totalWithdrawn: { $ifNull: [{ $arrayElemAt: ['$transactionTotals.withdrawn', 0] }, 0] },
    },
  },
];

interface AdminWalletDoc {
  _id: Types.ObjectId;
  userId: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  owner: {
    _id: Types.ObjectId;
    name: string;
    mobileNumber: string | null;
    state: string;
    district: string | null;
    category: string | null;
    role: string;
    verificationStatus: string;
    createdAt: Date;
    is_tester?: boolean;
  };
}

function toAdminWalletRow(doc: AdminWalletDoc): AdminWalletRow {
  return {
    id: String(doc._id),
    userId: String(doc.owner._id),
    balance: Number(doc.balance),
    totalEarned: Number(doc.totalEarned),
    totalWithdrawn: Number(doc.totalWithdrawn),
    owner: {
      id: String(doc.owner._id),
      name: doc.owner.name,
      mobileNumber: doc.owner.mobileNumber,
      state: doc.owner.state,
      district: doc.owner.district,
      category: doc.owner.category,
      role: doc.owner.role,
      verificationStatus: doc.owner.verificationStatus,
      createdAt: doc.owner.createdAt,
      isTester: !!doc.owner.is_tester,
    },
  };
}

@Injectable()
export class MongoWalletRepository
  extends MongoRepository<Wallet>
  implements IWalletRepository
{
  constructor(@InjectModel('Wallet') protected readonly _model: Model<Wallet>) {
    super(_model);
  }

  async findByUserId(userId: string): Promise<Wallet | null> {
    return this._model.findOne({ userId } as Record<string, unknown>).exec() as Promise<Wallet | null>;
  }

  async updateBalance(walletId: string, newBalance: number): Promise<void> {
    const { Types } = await import('mongoose');
    await this._model
      .updateOne({ _id: new Types.ObjectId(walletId) } as Record<string, unknown>, { $set: { balance: newBalance } })
      .exec();
  }

  async incrementBalance(walletId: string, amount: number, session?: ClientSession): Promise<number> {
    const { Types } = await import('mongoose');
    // Atomic conditional update: only increment if the resulting balance is >= 0
    // This replaces the old find+set pattern and prevents race-condition overshoots
    const updated = await this._model
      .findOneAndUpdate(
        { _id: new Types.ObjectId(walletId) } as Record<string, unknown>,
        { $inc: { balance: amount } } as Record<string, unknown>,
        { returnDocument: 'after' } as Record<string, unknown>,
      )
      .session(session ?? null)
      .exec();
    if (!updated) throw new Error(`Wallet ${walletId} not found`);
    return Number((updated as unknown as Record<string, number>).balance);
  }

  async decrement(filter: Record<string, unknown>, field: string, amount: number, session?: ClientSession): Promise<void> {
    await this._model
      .updateMany(toMongoFilter(filter) as Record<string, unknown>, { $inc: { [field]: -amount } } as Record<string, unknown>)
      .session(session ?? null)
      .exec();
  }

  async getTotalBalance(): Promise<number> {
  const [result] = await this._model.aggregate([
    {
      $group: {
        _id: null,
        total: {
          $sum: '$balance',
        },
      },
    },
  ]);

  return Number(result?.total ?? 0);
}

  async findAdminPage(
    scope: AdminWalletScope,
    { page, limit, sortBy, sortOrder }: AdminWalletPageOptions,
  ): Promise<{ items: AdminWalletRow[]; total: number }> {
    const direction = sortOrder === 'ASC' ? 1 : -1;
    const [result] = await this._model.aggregate<{ items: AdminWalletDoc[]; total: { count: number }[] }>([
      ...walletScopeStages(scope),
      {
        $facet: {
          total: [{ $count: 'count' }],
          // Transaction totals are looked up only for the wallets on this page.
          items: [
            { $sort: { [sortBy]: direction, _id: direction } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            ...TRANSACTION_TOTALS_STAGES,
            { $project: { userId: 1, balance: 1, totalEarned: 1, totalWithdrawn: 1, owner: 1 } },
          ],
        },
      },
    ]);

    return {
      items: (result?.items ?? []).map(toAdminWalletRow),
      total: result?.total[0]?.count ?? 0,
    };
  }

  async getAdminTotals(scope: AdminWalletScope): Promise<AdminWalletTotals> {
    const [result] = await this._model.aggregate<AdminWalletTotals>([
      ...walletScopeStages(scope),
      { $project: { balance: 1 } },
      ...TRANSACTION_TOTALS_STAGES,
      {
        $group: {
          _id: null,
          totalWallets: { $sum: 1 },
          totalBalance: { $sum: '$balance' },
          totalDistributed: { $sum: '$totalEarned' },
          totalWithdrawn: { $sum: '$totalWithdrawn' },
        },
      },
    ]);

    return {
      totalWallets: Number(result?.totalWallets ?? 0),
      totalBalance: Number(result?.totalBalance ?? 0),
      totalDistributed: Number(result?.totalDistributed ?? 0),
      totalWithdrawn: Number(result?.totalWithdrawn ?? 0),
    };
  }
}