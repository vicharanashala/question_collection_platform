import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ collection: 'sessions', timestamps: true })
export class Session {
  _id: Types.ObjectId;

  // Use Types.ObjectId + ref: 'User' if your users' _id is an ObjectId
  @Prop({ required: true, type: String, unique: true })
  userId: string; // one session per user

  @Prop({ required: true, type: String, unique: true })
  sessionId: string; // goes into the JWT as `sid`

  // Store only a hash, never the raw refresh token
  @Prop({ required: true, type: String, select: false })
  refreshTokenHash: string;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ type: Date, default: Date.now })
  lastActivityAt: Date;

  @Prop({type: String})
  requestId?: string;

  // Device info
  @Prop({ type: String })
  userAgent?: string;

  @Prop({ type: String })
  browser?: string;

  @Prop({ type: String })
  os?: string;

  @Prop({ type: String })
  device?: string;

  @Prop({ type: String })
  ipAddress?: string;

  createdAt: Date; // added by `timestamps: true`
  updatedAt: Date; // added by `timestamps: true`
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Cleanup: Mongo deletes the doc once expiresAt passes.
// To keep expired/revoked sessions around for audit, use expireAfterSeconds: 60 * 60 * 24 * 7 (7 days)
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });