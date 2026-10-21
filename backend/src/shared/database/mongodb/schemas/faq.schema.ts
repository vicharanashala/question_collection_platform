import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FaqCategory = 'account' | 'payment' | 'question' | 'general';

export type FaqDocument = Faq & Document;

export const FAQ_AUDIENCES = ['anveshan', 'user', 'all'] as const;
export type FaqAudience = (typeof FAQ_AUDIENCES)[number];

@Schema({ collection: 'faqs', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Faq {
  _id: Types.ObjectId;

  @Prop({ required: true })
  question: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ required: true, enum: ['account', 'payment', 'question', 'general'], default: 'general', index: true })
  category: FaqCategory;

  @Prop({ name: 'isVisible', default: true, index: true })
  isVisible: boolean;

  // Who can see this FAQ. Documents without a value are treated as 'all'.
  @Prop({ name: 'audience', default: 'all', enum: FAQ_AUDIENCES, index: true })
  audience: FaqAudience;

  @Prop({ name: 'displayOrder', default: 0, index: true })
  displayOrder: number;

  @Prop({ name: 'createdAt' })
  createdAt: Date;

  @Prop({ name: 'updatedAt' })
  updatedAt: Date;
}

export const FaqSchema = SchemaFactory.createForClass(Faq);