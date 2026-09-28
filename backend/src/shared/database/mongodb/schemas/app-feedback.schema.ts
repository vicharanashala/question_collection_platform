import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
export type AppFeedbackDocument = AppFeedback & Document;

@Schema({ collection: 'app_feedbacks', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class AppFeedback {
  _id: Types.ObjectId;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: ['anveshan_completion'] })
  context: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating: number;

  @Prop({ type: String, default: null })
  comment: string | null;

  @Prop({ required: true, enum: ['text', 'voice'], default: 'text' })
  inputMethod: string;

  @Prop({ name: 'createdAt' })
  createdAt: Date;

  @Prop({ name: 'updatedAt' })
  updatedAt: Date;
}

export const AppFeedbackSchema = SchemaFactory.createForClass(AppFeedback);
// One feedback per user per context.
AppFeedbackSchema.index({ userId: 1, context: 1 }, { unique: true });
