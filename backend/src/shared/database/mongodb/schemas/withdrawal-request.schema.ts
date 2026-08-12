import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PayoutMethod, WithdrawalStatus } from '../../../classes/enums';

export type WithdrawalRequestDocument = WithdrawalRequest & Document;

@Schema({ collection: 'withdrawal_requests', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class WithdrawalRequest {
  _id: Types.ObjectId;

  @Prop({ name: 'userId', required: true, index: true })
  userId: string;

  @Prop({ name: 'walletId', required: true, index: true })
  walletId: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ name: 'payoutMethod', required: true, enum: PayoutMethod })
  payoutMethod: PayoutMethod;

  @Prop({ name: 'payoutDetails', type: Object, required: true })
  payoutDetails: Record<string, unknown>;

  @Prop({ required: true, enum: WithdrawalStatus, index: true })
  status: WithdrawalStatus;

  @Prop({ name: 'pinelabsTransactionId', type: String, default: null })
  pinelabsTransactionId: string | null;

  @Prop({ name: 'orderId', type: String, unique: true, default: null })
  orderId: string | null;

  @Prop({ name: 'razorpayPayoutId', type: String, default: null })
  razorpayPayoutId: string | null;

  @Prop({ name: 'utrNumber', type: String, default: null })
  utrNumber: string | null;

  @Prop({ name: 'processedAt', type: Date, default: null })
  processedAt: Date | null;

  @Prop({ name: 'cancelledAt', type: Date, default: null })
  cancelledAt: Date | null;

  @Prop({ name: 'failureReason', type: String, default: null })
  failureReason: string | null;

  @Prop({ name: 'retryCount', default: 0 })
  retryCount: number;

  @Prop({ name: 'createdAt' })
  createdAt: Date;

  updatedAt: Date;
}

export const WithdrawalRequestSchema = SchemaFactory.createForClass(WithdrawalRequest);

// Compound index for common query pattern
WithdrawalRequestSchema.index({ userId: 1, status: 1 });
WithdrawalRequestSchema.index({ walletId: 1, createdAt: -1 });