import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportReplyDocument = ReportReply & Document;

@Schema({ collection: 'report_replies', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class ReportReply {
  _id: Types.ObjectId;

  @Prop({ name: 'reportId', required: true, index: true })
  reportId: string;

  @Prop({ name: 'adminId', required: true, index: true })
  adminId: string;

  @Prop({ required: true })
  message: string;

  @Prop({ name: 'createdAt' })
  createdAt: Date;

  updatedAt: Date;
}

export const ReportReplySchema = SchemaFactory.createForClass(ReportReply);