import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
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

// One rule result from the scoring service.
@Schema({ _id: false })
export class AnveshanAnswerScoreCheck {
  @Prop({ type: String, default: '' })
  parameter: string;

  @Prop({ type: String, default: '' })
  category: string;

  @Prop({ type: String, default: '' })
  result: string;

  @Prop({ type: Number, default: null })
  mark: number | null;

  @Prop({ type: String, default: '' })
  reason: string;
}

const AnveshanAnswerScoreCheckSchema = SchemaFactory.createForClass(AnveshanAnswerScoreCheck);

// System score for the answer; stays "processing" until the scoring job completes.
@Schema({ _id: false })
export class AnveshanAnswerScore {
  @Prop({ type: String, default: null })
  jobId: string | null;

  @Prop({ required: true, enum: ['processing', 'completed', 'failed'] })
  status: string;

  @Prop({ type: Number, default: null })
  systemScore: number | null;

  @Prop({ type: Number, default: null })
  maxScore: number | null;

  @Prop({ type: Number, default: null })
  percentage: number | null;

  @Prop({ type: Boolean, default: null })
  needsHumanReview: boolean | null;

  @Prop({ type: [String], default: [] })
  reviewReasons: string[];

  @Prop({ type: [AnveshanAnswerScoreCheckSchema], default: [] })
  checks: AnveshanAnswerScoreCheck[];

  @Prop({ type: [String], default: [] })
  notApplicable: string[];

  @Prop({ type: [String], default: [] })
  notEvaluated: string[];

  @Prop({ type: Date, default: null })
  checkedAt: Date | null;

  @Prop({ type: Date, required: true })
  requestedAt: Date;

  /** Full scoring service response, stored as received. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  response: Record<string, unknown> | null;
}

const AnveshanAnswerScoreSchema = SchemaFactory.createForClass(AnveshanAnswerScore);

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

  @Prop({ type: AnveshanAnswerScoreSchema, default: null })
  score: AnveshanAnswerScore | null;

  @Prop({ name: 'createdAt' })
  createdAt: Date;

  @Prop({ name: 'updatedAt' })
  updatedAt: Date;
}

export const AnveshanAnswerSchema = SchemaFactory.createForClass(AnveshanAnswer);
AnveshanAnswerSchema.index({ userId: 1, answeredAt: -1 });
