import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis service wrapper for rate-limiting and caching.
 * Falls back to an in-memory map when Redis is unavailable (dev/test mode).
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | InMemoryStore;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('redis.host') ?? 'localhost';
    const port = this.configService.get<number>('redis.port') ?? 6379;
    const password = this.configService.get<string>('redis.password');

    const redis = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
    });

    // When Redis hits an error, disconnect and swap to in-memory store so that
    // subsequent requests are served by the fallback immediately.
    redis.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message} — switching to in-memory fallback`);
      redis.disconnect(false);
      this.client = new InMemoryStore();
    });

    redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client = redis;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client instanceof Redis) {
      await this.client.quit().catch(() => {/* ignore */});
    }
  }

  private safeOp<T>(op: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    return op().catch(() => fallback());
  }

  async get(key: string): Promise<string | null> {
    return this.safeOp(
      () => (this.client as Redis).get(key),
      () => (this.client as InMemoryStore).get(key),
    );
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    return this.safeOp(
      async () => {
        if (ttlSeconds !== undefined) {
          await (this.client as Redis).set(key, value, 'EX', ttlSeconds);
        } else {
          await (this.client as Redis).set(key, value);
        }
      },
      async () => {
        await (this.client as InMemoryStore).set(key, value);
      },
    );
  }

  async incr(key: string): Promise<number> {
    return this.safeOp(
      () => (this.client as Redis).incr(key),
      () => (this.client as InMemoryStore).incr(key),
    );
  }

  async expire(key: string, seconds: number): Promise<void> {
    return this.safeOp(
      () => (this.client as Redis).expire(key, seconds),
      () => (this.client as InMemoryStore).expire(key, seconds),
    );
  }

  async del(key: string): Promise<void> {
    return this.safeOp(
      () => (this.client as Redis).del(key),
      () => (this.client as InMemoryStore).del(key),
    );
  }
}

/**
 * In-memory fallback store when Redis is unavailable.
 * Suitable for development and testing only.
 */
class InMemoryStore {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, mode?: string, ttl?: number): Promise<void> {
    const expiresAt = mode === 'EX' && ttl ? Date.now() + ttl * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = (parseInt(current ?? '0', 10) + 1).toString();
    const entry = this.store.get(key);
    this.store.set(key, { value: next, expiresAt: entry?.expiresAt ?? null });
    return parseInt(next, 10);
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000;
    }
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}