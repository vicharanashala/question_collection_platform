import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ReportCategory, ReportPriority, ReportStatus } from '../../../classes/enums';

export type ReportDocument = Report & Document;

@Schema({ collection: 'reports', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Report {
  _id: Types.ObjectId;

  @Prop({ name: 'userId', required: true, index: true })
  userId: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: ReportCategory })
  category: ReportCategory;

  @Prop({ required: true, enum: ReportStatus, default: ReportStatus.OPEN, index: true })
  status: ReportStatus;

  @Prop({ required: true, enum: ReportPriority, default: ReportPriority.MEDIUM })
  priority: ReportPriority;

  @Prop({ name: 'relatedEntityId', type: String, index: true, default: null })
  relatedEntityId: string | null;

  @Prop({ name: 'relatedEntityType', type: String, default: null })
  relatedEntityType: string | null;

  @Prop({ name: 'createdAt' })
  createdAt: Date;

  @Prop({ name: 'updatedAt' })
  updatedAt: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

ReportSchema.index({ userId: 1, createdAt: -1 });
ReportSchema.index({ status: 1, priority: -1 });