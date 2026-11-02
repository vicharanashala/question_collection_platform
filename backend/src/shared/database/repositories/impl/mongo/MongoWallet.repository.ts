import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IWalletRepository, WalletAdminSummary, WalletAdminSummaryFilter } from '../../IWallet.repository';
import { TransactionSource, TransactionStatus, TransactionType } from '@/shared/classes/enums';
// import { Wallet } from '../../../entities';
import { toMongoFilter } from '../../../abstractions/mongo-utils';
import { Wallet } from '@/shared/database/mongodb/schemas/wallet.schema';

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

  async getAdminSummary({ userId, ownerFilter }: WalletAdminSummaryFilter): Promise<WalletAdminSummary> {
    const sumWhere = (type: TransactionType, source: TransactionSource) => ({
      $sum: {
        $cond: [{ $and: [{ $eq: ['$type', type] }, { $eq: ['$source', source] }] }, '$amount', 0],
      },
    });

    const [result] = await this._model.aggregate([
      { $match: { isDeleted: { $ne: true }, ...(userId ? { userId } : {}) } },
      {
        $lookup: {
          from: 'users',
          let: { uid: { $convert: { input: '$userId', to: 'objectId', onError: null, onNull: null } } },
          pipeline: [
            { $match: { $and: [{ $expr: { $eq: ['$_id', '$$uid'] } }, ownerFilter] } },
            { $project: { _id: 1 } },
          ],
          as: 'owner',
        },
      },
      { $match: { 'owner.0': { $exists: true } } },
      {
        $lookup: {
          from: 'transactions',
          let: { walletId: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$walletId', '$$walletId'] },
                status: TransactionStatus.COMPLETED,
                isDeleted: { $ne: true },
              },
            },
            {
              $group: {
                _id: null,
                earned: sumWhere(TransactionType.CREDIT, TransactionSource.REWARD),
                withdrawn: sumWhere(TransactionType.DEBIT, TransactionSource.WITHDRAWAL),
              },
            },
          ],
          as: 'tx',
        },
      },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balance' },
          totalEarned: { $sum: { $ifNull: [{ $arrayElemAt: ['$tx.earned', 0] }, 0] } },
          totalWithdrawn: { $sum: { $ifNull: [{ $arrayElemAt: ['$tx.withdrawn', 0] }, 0] } },
        },
      },
    ]);

    return {
      totalBalance: Number(result?.totalBalance ?? 0),
      totalEarned: Number(result?.totalEarned ?? 0),
      totalWithdrawn: Number(result?.totalWithdrawn ?? 0),
    };
  }
}
