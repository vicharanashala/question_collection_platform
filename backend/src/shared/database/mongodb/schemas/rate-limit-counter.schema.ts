import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RateLimitCounterDocument = RateLimitCounter & Document;

/**
 * Fixed-window request counter, used as the rate-limit store when Redis is disabled.
 *
 * Documents are short-lived: the TTL index reclaims them once the window has passed, so
 * the collection stays roughly proportional to the number of active callers.
 */
@Schema({ collection: 'rate_limit_counters' })
export class RateLimitCounter {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  key: string;

  @Prop({ required: true, default: 0 })
  count: number;

  // Mongo's TTL monitor sweeps about once a minute, so expired windows can linger
  // briefly. Window boundaries are therefore enforced by query, not by the index.
  @Prop({ required: true, index: { expireAfterSeconds: 0 } })
  expiresAt: Date;
}

export const RateLimitCounterSchema =
  SchemaFactory.createForClass(RateLimitCounter);
