import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { ITransactionRepository } from '../../ITransaction.repository';
import { Transaction } from '../../../entities';

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
}