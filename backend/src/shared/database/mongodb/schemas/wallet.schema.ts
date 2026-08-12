import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletDocument = Wallet & Document;

@Schema({ collection: 'wallets', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Wallet {
  _id: Types.ObjectId;

  @Prop({ name: 'userId', required: true, unique: true, index: true })
  userId: string;

  @Prop({ required: true, default: 0 })
  balance: number;

  @Prop({ default: 'INR' })
  currency: string;

  createdAt: Date;
  updatedAt: Date;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);