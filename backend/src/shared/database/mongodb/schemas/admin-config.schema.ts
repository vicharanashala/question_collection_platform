import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AdminConfigDocument = AdminConfig & Document;

@Schema({ collection: 'admin_configs', timestamps: { updatedAt: 'updatedAt' } })
export class AdminConfig {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ type: Object, required: true })
  value: unknown;

  @Prop({ type: String, default: null })
  description: string | null;

  @Prop({ name: 'updatedBy', type: String, default: null })
  updatedBy: string | null;

  @Prop({ name: 'updatedAt' })
  updatedAt: Date;
}

export const AdminConfigSchema = SchemaFactory.createForClass(AdminConfig);