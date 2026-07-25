import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { QuestionStatus, MediaType } from '../../../classes/enums';

export type QuestionDocument = Question & Document;

@Schema({ collection: 'questions', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Question {
  _id: Types.ObjectId;

  @Prop({ name: 'userId', required: true, index: true })
  userId: string;

  @Prop({ required: true, default: 'en', index: true })
  language: string;

  @Prop({ type: [String], default: [], index: true })
  domains: string[];

  @Prop({ required: true })
  season: string;

  @Prop({ name: 'cropType', required: true, index: true })
  cropType: string;

  @Prop({ name: 'agroClimaticZone', type: String, default: null })
  agroClimaticZone: string | null;

  @Prop({ required: true, index: true })
  state: string;

  @Prop({ required: true })
  district: string;

  @Prop({ type: String, default: null })
  block: string | null;

  @Prop({ name: 'questionText', required: true })
  questionText: string;

  /** Vector embedding — stored as array of floats. For external vector DB lookups (GdbService). */
  @Prop({ type: [Number], default: null })
  embedding: number[] | null;

  @Prop({ name: 'mediaType', required: true, enum: MediaType, default: MediaType.NONE })
  mediaType: MediaType;

  @Prop({ name: 'mediaUrls', type: [String], default: null })
  mediaUrls: string[] | null;

  @Prop({ name: 'deviceInfo', type: Object, default: null })
  deviceInfo: Record<string, unknown> | null;

  @Prop({ required: true, enum: QuestionStatus, default: QuestionStatus.PENDING, index: true })
  status: QuestionStatus;

  @Prop({ name: 'duplicateFlag', default: false })
  duplicateFlag: boolean;

  @Prop({ name: 'duplicateOfId', type: String, index: true, default: null })
  duplicateOfId: string | null;

  @Prop({ name: 'submittedAt', required: true, index: true })
  submittedAt: Date;

  @Prop({ name: 'reviewedAt', type: Date, default: null })
  reviewedAt: Date | null;

  @Prop({ name: 'reviewerId', type: String, default: null })
  reviewerId: string | null;

  @Prop({ name: 'rejectionReason', type: String, default: null })
  rejectionReason: string | null;

  @Prop({ name: 'heldReason', type: String, default: null })
  heldReason: string | null;

  @Prop({ name: 'approvalReason', type: String, default: null })
  approvalReason: string | null;

  @Prop({ name: 'createdAt' })
  createdAt: Date;

  @Prop({ name: 'updatedAt' })
  updatedAt: Date;
}

export const QuestionSchema = SchemaFactory.createForClass(Question);

// Text index for full-text search on question text
QuestionSchema.index({ questionText: 'text' });
// Compound indexes for common query patterns
QuestionSchema.index({ userId: 1, submittedAt: -1 });
QuestionSchema.index({ status: 1, submittedAt: -1 });