import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { NotificationType, NotificationTriggerType } from '../../../classes/enums';

export type NotificationDocument = Notification & Document;

@Schema({ collection: 'notifications', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Notification {
  _id: Types.ObjectId;

  @Prop({ name: 'userId', required: true, index: true })
  userId: string;

  @Prop({ required: true, enum: NotificationType, index: true })
  type: NotificationType;

  @Prop({
    name: 'triggerType',
    enum: NotificationTriggerType,
    default: NotificationTriggerType.QUESTION,
    index: true,
  })
  triggerType: NotificationTriggerType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ name: 'data', type: Object, default: null })
  data: Record<string, unknown> | null;

  @Prop({ name: 'isRead', default: false, index: true })
  isRead: boolean;

  @Prop({ name: 'createdAt' })
  createdAt: Date;

  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });