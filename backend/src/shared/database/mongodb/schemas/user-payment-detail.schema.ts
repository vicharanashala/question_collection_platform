import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PayoutMethod } from '../../../classes/enums';

export type UserPaymentDetailDocument = UserPaymentDetail & Document;

@Schema({ collection: 'user_payment_details', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class UserPaymentDetail {
  _id: Types.ObjectId;

  @Prop({ name: 'userId', required: true, index: true })
  userId: string;

  @Prop({ name: 'payoutMethod', required: true, enum: PayoutMethod })
  payoutMethod: PayoutMethod;

  @Prop({ name: 'upiId', type: String, default: null })
  upiId: string | null;

  @Prop({ name: 'accountNumberLast4', type: String, default: null })
  accountNumberLast4: string | null;

  @Prop({ type: String, default: null })
  ifsc: string | null;

  @Prop({ name: 'ifscEncrypted', type: String, default: null })
  ifscEncrypted: string | null;

  @Prop({ name: 'accountHolderName', type: String, default: null })
  accountHolderName: string | null;

  @Prop({ name: 'accountHolderNameEncrypted', type: String, default: null })
  accountHolderNameEncrypted: string | null;

  @Prop({ name: 'bankName', type: String, default: null })
  bankName: string | null;

  @Prop({ name: 'accountNumberEncrypted', type: String, default: null })
  accountNumberEncrypted: string | null;

  @Prop({
    required: true,
    enum: ['pending', 'in_progress', 'verified', 'failed'],
    default: 'pending',
    index: true,
  })
  status: 'pending' | 'in_progress' | 'verified' | 'failed';

  @Prop({ name: 'verificationOrderId', type: String, unique: true, default: null })
  verificationOrderId: string | null;

  @Prop({ name: 'withdrawalRequestId', type: String, default: null })
  withdrawalRequestId: string | null;

  @Prop({ name: 'verificationFailedReason', type: String, default: null })
  verificationFailedReason: string | null;

  @Prop({ name: 'verifiedAt', type: Date, default: null })
  verifiedAt: Date | null;

  @Prop({ name: 'razorpayFundAccountId', type: String, default: null })
  razorpayFundAccountId: string | null;

  @Prop({ name: 'razorpayPayoutId', type: String, default: null })
  razorpayPayoutId: string | null;

  @Prop({ name: 'razorpayPaymentLinkId', type: String, default: null })
  razorpayPaymentLinkId: string | null;

  @Prop({ name: 'razorpayPaymentLinkUrl', type: String, default: null })
  razorpayPaymentLinkUrl: string | null;

  @Prop({ name: 'razorpayValidationId', type: String, index: true, default: null })
  razorpayValidationId: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const UserPaymentDetailSchema = SchemaFactory.createForClass(UserPaymentDetail);