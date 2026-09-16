import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisService } from './redis.service';
import { RateLimitCounterDocument } from '../mongodb/schemas/rate-limit-counter.schema';

export interface RateLimitHit {
  /** Number of requests recorded in the current window, including this one. */
  count: number;
  /** Seconds until the current window resets. */
  ttlSeconds: number;
}

/**
 * Fixed-window counter backing all rate limiting.
 *
 * Redis is used when enabled. When it is not, counters are kept in MongoDB so limits
 * stay enforced instead of silently disappearing — OTP requests in particular cost real
 * money and must not become unbounded just because there is no cache tier.
 */
@Injectable()
export class RateLimitCounterService {
  constructor(
    private readonly redis: RedisService,
    @InjectModel('RateLimitCounter')
    private readonly counterModel: Model<RateLimitCounterDocument>,
  ) {}

  // Records one request against the key and returns the resulting window state.
  async hit(key: string, windowSeconds: number): Promise<RateLimitHit> {
    if (this.redis.isEnabled()) {
      const count = await this.redis.incr(key);
      if (count === 1) {
        await this.redis.expire(key, windowSeconds);
      }
      const ttl = await this.redis.ttl(key);
      return { count, ttlSeconds: ttl > 0 ? ttl : windowSeconds };
    }

    const now = new Date();

    // Increment only while the window is still open. A miss means the window has
    // lapsed (or never existed) and a fresh one starts below.
    const open = await this.counterModel.findOneAndUpdate(
      { key, expiresAt: { $gt: now } },
      { $inc: { count: 1 } },
      { new: true },
    );
    if (open) {
      return {
        count: open.count,
        ttlSeconds: this.secondsUntil(open.expiresAt),
      };
    }

    const expiresAt = new Date(now.getTime() + windowSeconds * 1000);
    const started = await this.counterModel.findOneAndUpdate(
      { key },
      { $set: { count: 1, expiresAt } },
      { new: true, upsert: true },
    );
    return { count: started.count, ttlSeconds: windowSeconds };
  }

  // Reads the current window without recording a request.
  async peek(key: string): Promise<RateLimitHit | null> {
    if (this.redis.isEnabled()) {
      const current = await this.redis.get(key);
      if (current === null) return null;
      const ttl = await this.redis.ttl(key);
      return {
        count: parseInt(current, 10) || 0,
        ttlSeconds: ttl > 0 ? ttl : 0,
      };
    }

    const existing = await this.counterModel.findOne({
      key,
      expiresAt: { $gt: new Date() },
    });
    if (!existing) return null;
    return {
      count: existing.count,
      ttlSeconds: this.secondsUntil(existing.expiresAt),
    };
  }

  // Clears the window for a key, e.g. after a successful verification.
  async reset(key: string): Promise<void> {
    if (this.redis.isEnabled()) {
      await this.redis.del(key);
      return;
    }
    await this.counterModel.deleteOne({ key });
  }

  private secondsUntil(date: Date): number {
    return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
  }
}
