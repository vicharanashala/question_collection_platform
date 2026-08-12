import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentLogStatus } from '../../../classes/enums';

export type PaymentLogDocument = PaymentLog & Document;

@Schema({ collection: 'payment_logs', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class PaymentLog {
  _id: Types.ObjectId;

  @Prop({ name: 'withdrawalRequestId', required: true, index: true })
  withdrawalRequestId: string;

  @Prop({ name: 'adminId', type: String, default: null })
  adminId: string | null;

  @Prop({ name: 'orderId', required: true })
  orderId: string;

  @Prop({ name: 'pinelabsTransactionId', type: String, default: null })
  pinelabsTransactionId: string | null;

  @Prop({ name: 'razorpayPayoutId', type: String, default: null })
  razorpayPayoutId: string | null;

  @Prop({ name: 'utrNumber', type: String, default: null })
  utrNumber: string | null;

  @Prop({ required: true, enum: PaymentLogStatus })
  status: PaymentLogStatus;

  @Prop({ name: 'errorCode', type: String, default: null })
  errorCode: string | null;

  @Prop({ name: 'errorMessage', type: String, default: null })
  errorMessage: string | null;

  @Prop({ name: 'rawResponse', type: Object, default: null })
  rawResponse: Record<string, unknown> | null;

  @Prop({ name: 'attemptedAt' })
  attemptedAt: Date;

  updatedAt: Date;
}

export const PaymentLogSchema = SchemaFactory.createForClass(PaymentLog);