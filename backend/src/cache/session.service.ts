import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { sessionKey, sessionPattern } from './cache.keys';
import { CacheTTL } from '../config/cache-ttl.constants';

export interface SessionData {
  userId: number;
  deviceId: string;
  role: string;
  createdAt: string;
  lastActiveAt: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly ttlDays: number;

  constructor(
    private readonly redis: RedisService,
  ) {
    this.ttlDays = CacheTTL.SESSION_DAYS;
  }

  /** Store or refresh a session in Redis. */
  async setSession(userId: number, deviceId: string, role: string): Promise<void> {
    const key = sessionKey(userId, deviceId);
    const now = new Date().toISOString();
    const session: SessionData = {
      userId,
      deviceId,
      role,
      createdAt: now,
      lastActiveAt: now,
    };
    await this.redis.set(key, JSON.stringify(session), this.ttlDays * 24 * 3600);
  }

  /** Get session data. Returns null if not found or expired. */
  async getSession(userId: number, deviceId: string): Promise<SessionData | null> {
    const key = sessionKey(userId, deviceId);
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  /** Refresh lastActiveAt timestamp without changing other fields. */
  async touchSession(userId: number, deviceId: string): Promise<void> {
    const session = await this.getSession(userId, deviceId);
    if (!session) return;
    session.lastActiveAt = new Date().toISOString();
    const key = sessionKey(userId, deviceId);
    const ttl = await this.redis.ttl(key);
    if (ttl > 0) {
      await this.redis.set(key, JSON.stringify(session), ttl);
    } else {
      await this.redis.set(key, JSON.stringify(session), this.ttlDays * 24 * 3600);
    }
  }

  /** Invalidate a specific session on logout. */
  async invalidateSession(userId: number, deviceId: string): Promise<void> {
    const key = sessionKey(userId, deviceId);
    await this.redis.del(key);
  }

  /**
   * Invalidate all sessions for a user (e.g. password change, admin lock).
   * Uses SCAN to find matching keys rather than KEYS (production-safe).
   */
  async invalidateAllUserSessions(userId: number): Promise<number> {
    const pattern = sessionPattern(userId);
    return this.redis.delByPattern(pattern);
  }

  /** Extend session TTL (e.g. on repeated successful activity). */
  async extendSession(userId: number, deviceId: string): Promise<void> {
    const key = sessionKey(userId, deviceId);
    await this.redis.expire(key, this.ttlDays * 24 * 3600);
  }
}