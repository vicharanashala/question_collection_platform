import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoRepository } from '../../../abstractions/mongo.repository';
import { IUserPaymentDetailRepository } from '../../IUserPaymentDetail.repository';
// import { UserPaymentDetail } from '../../../entities';
import { UserPaymentDetail } from '@/shared/database/mongodb/schemas/user-payment-detail.schema';
@Injectable()
export class MongoUserPaymentDetailRepository
  extends MongoRepository<UserPaymentDetail>
  implements IUserPaymentDetailRepository
{
  constructor(@InjectModel('UserPaymentDetail') protected readonly _model: Model<UserPaymentDetail>) {
    super(_model);
  }

  async findByUserId(userId: string): Promise<UserPaymentDetail | null> {
    return this._model
      .findOne({ userId } as Record<string, unknown>)
      .exec() as Promise<UserPaymentDetail | null>;
  }

  async findByRazorpayValidationId(validationId: string): Promise<UserPaymentDetail | null> {
    return this._model
      .findOne({ razorpayValidationId: validationId } as Record<string, unknown>)
      .exec() as Promise<UserPaymentDetail | null>;
  }

  async findLatestVerifiedByUserId(userId: string) {
  return this._model
    .findOne({ userId, status: 'verified' })
    .sort({ verifiedAt: -1 })
    .lean()
    .exec();
}
}