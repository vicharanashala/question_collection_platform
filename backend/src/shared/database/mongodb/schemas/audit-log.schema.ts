import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ActorType } from '../../../classes/enums';

export type AuditLogDocument = AuditLog & Document;

@Schema({ collection: 'audit_logs', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class AuditLog {
  _id: Types.ObjectId;

  @Prop({ name: 'actorType', required: true, enum: ActorType, index: true })
  actorType: ActorType;

  @Prop({ name: 'actorId', type: String, default: null })
  actorId: string | null;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ name: 'entityType', type: String, index: true, default: null })
  entityType: string | null;

  @Prop({ name: 'entityId', type: String, default: null })
  entityId: string | null;

  @Prop({ name: 'oldValue', type: Object, default: null })
  oldValue: Record<string, unknown> | null;

  @Prop({ name: 'newValue', type: Object, default: null })
  newValue: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  metadata: Record<string, unknown> | null;

  @Prop({ name: 'createdAt', index: true })
  createdAt: Date;

  updatedAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Compound indexes for filtered audit queries
AuditLogSchema.index({ actorType: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });