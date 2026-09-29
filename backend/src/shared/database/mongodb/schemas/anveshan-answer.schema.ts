import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
export type AnveshanAnswerDocument = AnveshanAnswer & Document;

// One supporting reference for an answer; stored without its own _id.
@Schema({ _id: false })
export class AnveshanAnswerSource {
  @Prop({ required: true, enum: ['hyper_local', 'state', 'central', 'other'] })
  sourceType: string;

  @Prop({ required: true })
  sourceName: string;

  @Prop({ required: true })
  source: string;

  @Prop({ type: String, default: null })
  page: string | null;
}

const AnveshanAnswerSourceSchema = SchemaFactory.createForClass(AnveshanAnswerSource);

@Schema({ collection: 'anveshan_answers', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class AnveshanAnswer {
  _id: Types.ObjectId;

  /** The answered question. Unique, so each question has at most one answer. */
  @Prop({ required: true, unique: true })
  questionId: string;

  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true })
  answer: string;

  @Prop({ type: [AnveshanAnswerSourceSchema], default: [] })
  sources: AnveshanAnswerSource[];

  @Prop({ type: String, default: null })
  remarks: string | null;

  @Prop({ required: true })
  answeredAt: Date;

  @Prop({ name: 'createdAt' })
  createdAt: Date;

  @Prop({ name: 'updatedAt' })
  updatedAt: Date;
}

export const AnveshanAnswerSchema = SchemaFactory.createForClass(AnveshanAnswer);
AnveshanAnswerSchema.index({ userId: 1, answeredAt: -1 });
