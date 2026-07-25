import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IPaymentLogRepository } from '../../IPaymentLog.repository';
import { PaymentLog } from '../../../entities';

@Injectable()
export class MongoPaymentLogRepository
  extends MongoRepository<PaymentLog>
  implements IPaymentLogRepository
{
  constructor(@InjectModel('PaymentLog') protected readonly _model: Model<PaymentLog>) {
    super(_model);
  }

  async findByWithdrawalRequestId(withdrawalRequestId: string): Promise<PaymentLog[]> {
    return this._model
      .find({ withdrawalRequestId })
      .sort({ createdAt: -1 })
      .exec() as Promise<PaymentLog[]>;
  }
}