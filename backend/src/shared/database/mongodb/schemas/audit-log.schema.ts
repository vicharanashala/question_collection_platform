import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ActorType, AuditAction, OutcomeStatus } from '../../../classes/enums';

export type AuditLogDocument = AuditLog & Document;

@Schema({ collection: 'audit_logs', timestamps: { createdAt: true, updatedAt: false } })
export class AuditLog {
  _id: Types.ObjectId;
 
  @Prop({ required: true, enum: AuditAction, index: true })
  actionType: AuditAction;
 
  @Prop({ type: Object, default: null })
  actor: { id: string; actorType: ActorType; name: string; } | null;
 
  @Prop({ type: Object, default: null })
  context: Record<string, any>| null;

  @Prop({ type: Object, default: null })
  changes: {
    before: Record<string, any> | null;
    after: Record<string, any> | null;
  }
  
  @Prop({ type: Object, default: null })
  outcome: {
    status: OutcomeStatus;
    errorCode?: string;
    errorMessage?: string;
    errorName?: string;
    errorStack?: string;
  } | null;

  @Prop ({ required: true, default: null, type: Object})
  resource: {
    ipAddress?: string;
    requestId?: string;
  }
 
  createdAt: Date;
}
 
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
 
// Indexes for filtered audit queries
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ 'actor.actorType': 1, createdAt: -1 });
AuditLogSchema.index({ 'actor.id': 1, createdAt: -1 });