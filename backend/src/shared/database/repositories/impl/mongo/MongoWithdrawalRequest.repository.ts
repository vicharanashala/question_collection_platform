import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IWithdrawalRequestRepository } from '../../IWithdrawalRequest.repository';
import { WithdrawalRequest } from '../../../entities';
import { WithdrawalStatus } from '../../../../classes/enums';

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
}