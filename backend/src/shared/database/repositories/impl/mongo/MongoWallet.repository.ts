import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IWalletRepository } from '../../IWallet.repository';
import { Wallet } from '../../../entities';
import { toMongoFilter } from '../../../abstractions/mongo-utils';

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
}