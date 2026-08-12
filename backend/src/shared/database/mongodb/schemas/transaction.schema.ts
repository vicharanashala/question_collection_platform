import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TransactionType, TransactionSource, TransactionStatus } from '../../../classes/enums';

export type TransactionDocument = Transaction & Document;

@Schema({ collection: 'transactions', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Transaction {
  _id: Types.ObjectId;

  @Prop({ name: 'walletId', required: true, index: true })
  walletId: string;

  @Prop({ required: true, enum: TransactionType })
  type: TransactionType;

  @Prop({ required: true, enum: TransactionSource })
  source: TransactionSource;

  @Prop({ required: true })
  amount: number;

  @Prop({ name: 'balanceAfter', required: true })
  balanceAfter: number;

  @Prop({ name: 'referenceId', type: String, index: true, default: null })
  referenceId: string | null;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ name: 'rejectionReason', type: String, default: null })
  rejectionReason: string | null;

  @Prop({ required: true, enum: TransactionStatus, index: true })
  status: TransactionStatus;

  @Prop({ name: 'createdAt', index: true })
  createdAt: Date;

  updatedAt: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);