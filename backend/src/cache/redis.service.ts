import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis service wrapper for rate-limiting, caching, session management, and more.
 * Falls back to an in-memory map when Redis is unavailable (dev/test mode).
 */
@Injectable()
export class RedisService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | InMemoryStore;
  private redisNative: Redis | null = null;

  constructor(private readonly configService: ConfigService) {
    const redisEnabled = this.configService.get<boolean>('redis.redisEnabled') ?? true;

    if (!redisEnabled) {
      this.logger.log('REDIS_ENABLED=false — using in-memory store');
      this.client = new InMemoryStore();
      return;
    }

    const host = this.configService.get<string>('redis.host') ?? 'localhost';
    const port = this.configService.get<number>('redis.port') ?? 6379;
    const password = this.configService.get<string>('redis.password');
    const db = this.configService.get<number>('redis.db') ?? 0;
    const tls = this.configService.get<boolean>('redis.tls') ?? false;

    // Build Redis options avoiding the tls: true|undefined overload confusion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redisOpts: any = {
      host,
      port,
      password: password || undefined,
      db,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
    };
    if (tls) {
      // ioredis accepts a tls.ConnectionOptions object; {} enables TLS with default certs.
      // For production with custom certs, pass { cert, key, ca } files in env.
      redisOpts.tls = {};
    }

    const redis = new Redis(redisOpts);

    redis.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message} — switching to in-memory fallback`);
      try { redis.disconnect(false); } catch { /* ignore */ }
      this.client = new InMemoryStore();
    });

    redis.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client = redis;
    this.redisNative = redis;
  }

  async onModuleInit(): Promise<void> {
    if (this.redisNative) {
      try {
        await this.redisNative.connect();
      } catch (err: any) {
        this.logger.warn(`Redis connection failed on init: ${err.message} — falling back to in-memory store`);
        this.client = new InMemoryStore();
        this.redisNative = null;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisNative) {
      await this.redisNative.quit().catch(() => {/* ignore */});
    }
  }

  /** Returns true when the live Redis client is in use (not in-memory fallback). */
  isLive(): boolean {
    return this.redisNative !== null && this.client === this.redisNative;
  }

  // ─── Core operations ─────────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    return (this.client as Redis).get(key).catch(() => (this.client as InMemoryStore).get(key));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await (this.client as Redis).set(key, value, 'EX', ttlSeconds).catch(() => (this.client as InMemoryStore).set(key, value));
    } else {
      await (this.client as Redis).set(key, value).catch(() => (this.client as InMemoryStore).set(key, value));
    }
  }

  /**
   * Set a key only if it does not already exist (NX).
   * Returns true if the key was set, false if it already existed.
   */
  async setnx(key: string, value: string): Promise<boolean> {
    const result = await (this.client as Redis).setnx(key, value).catch(() => (this.client as InMemoryStore).setnx(key, value));
    return result === 1;
  }

  /**
   * Set with NX and TTL combined. Returns true if key was set, false if already existed.
   */
  async setnxWithTTL(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await (this.client as Redis)
      .set(key, value, 'EX', ttlSeconds, 'NX')
      .catch(() => (this.client as InMemoryStore).setnxWithTTL(key, value, ttlSeconds));
    return result === 'OK' || result === true;
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return (this.client as Redis).del(...keys).catch(() => (this.client as InMemoryStore).del(...keys));
  }

  async exists(key: string): Promise<number> {
    return (this.client as Redis).exists(key).catch(() => (this.client as InMemoryStore).exists(key));
  }

  async incr(key: string): Promise<number> {
    return (this.client as Redis).incr(key).catch(() => (this.client as InMemoryStore).incr(key));
  }

  async incrby(key: string, increment: number): Promise<number> {
    return (this.client as Redis).incrby(key, increment).catch(() => (this.client as InMemoryStore).incrby(key, increment));
  }

  async expire(key: string, seconds: number): Promise<number> {
    return (this.client as Redis).expire(key, seconds).catch(() => (this.client as InMemoryStore).expire(key, seconds));
  }

  async ttl(key: string): Promise<number> {
    return (this.client as Redis).ttl(key).catch(() => (this.client as InMemoryStore).ttl(key));
  }

  async ping(): Promise<string> {
    return (this.client as Redis).ping().catch(() => (this.client as InMemoryStore).ping());
  }

  // ─── Batch helpers ───────────────────────────────────────────────────────────

  async mget(...keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return (this.client as Redis).mget(...keys).catch(() => (this.client as InMemoryStore).mget(...keys));
  }

  async mset(...keyValuePairs: string[]): Promise<void> {
    if (keyValuePairs.length === 0) return;
    await (this.client as Redis).mset(...keyValuePairs).catch(() => (this.client as InMemoryStore).mset(...keyValuePairs));
  }

  // ─── Hash helpers ────────────────────────────────────────────────────────────

  async hget(key: string, field: string): Promise<string | null> {
    return (this.client as Redis).hget(key, field).catch(() => (this.client as InMemoryStore).hget(key, field));
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return (this.client as Redis).hset(key, field, value).catch(() => (this.client as InMemoryStore).hset(key, field, value));
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return (this.client as Redis).hgetall(key).catch(() => (this.client as InMemoryStore).hgetall(key));
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return (this.client as Redis).hincrby(key, field, increment).catch(() => (this.client as InMemoryStore).hincrby(key, field, increment));
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return (this.client as Redis).hdel(key, ...fields).catch(() => (this.client as InMemoryStore).hdel(key, ...fields));
  }

  // ─── Sorted set helpers (leaderboards, time-series) ─────────────────────────

  async zadd(key: string, score: number, member: string): Promise<number> {
    return (this.client as Redis).zadd(key, score, member).catch(() => (this.client as InMemoryStore).zadd(key, score, member));
  }

  async zincrby(key: string, increment: number, member: string): Promise<string> {
    return (this.client as Redis).zincrby(key, increment, member).catch(() => (this.client as InMemoryStore).zincrby(key, increment, member));
  }

  async zscore(key: string, member: string): Promise<string | null> {
    return (this.client as Redis).zscore(key, member).catch(() => (this.client as InMemoryStore).zscore(key, member));
  }

  /** Get top members from a sorted set (descending by score), with scores. */
  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return (this.client as Redis).zrevrange(key, start, stop, 'WITHSCORES').catch(
      () => (this.client as InMemoryStore).zrevrange(key, start, stop),
    );
  }

  /** Get members within a score range (inclusive), with scores. */
  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    return (this.client as Redis).zrangebyscore(key, min, max, 'WITHSCORES').catch(
      () => (this.client as InMemoryStore).zrangebyscore(key, min, max),
    );
  }

  async zcard(key: string): Promise<number> {
    return (this.client as Redis).zcard(key).catch(() => (this.client as InMemoryStore).zcard(key));
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return (this.client as Redis).zrem(key, ...members).catch(() => (this.client as InMemoryStore).zrem(key, ...members));
  }

  // ─── Distributed lock helpers ────────────────────────────────────────────────

  /**
   * Acquire a simple distributed lock using SET NX EX.
   * Returns a lock token if acquired, null otherwise.
   */
  async lock(key: string, ttlSeconds = 10): Promise<string | null> {
    const token = `lock:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const acquired = await this.setnxWithTTL(key, token, ttlSeconds);
    return acquired ? token : null;
  }

  /**
   * Release a distributed lock only if the token matches (Lua script for atomicity).
   */
  async unlock(key: string, token: string): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await (this.client as Redis).eval(script, 1, key, token).catch(() => {/* ignore — best-effort */});
  }

  // ─── Scan helper ─────────────────────────────────────────────────────────────

  /**
   * Scan keys matching a pattern. Returns all matching keys.
   * Use sparingly in production — prefer specific key patterns.
   */
  async scan(pattern: string, count = 100): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await (this.client as Redis)
        .scan(cursor, 'MATCH', pattern, 'COUNT', count)
        .catch(() => ['0', []] as [string, string[]]);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }

  /**
   * Delete all keys matching a pattern (for cache flush).
   */
  async delByPattern(pattern: string): Promise<number> {
    const keys = await this.scan(pattern);
    if (keys.length === 0) return 0;
    return this.del(...keys);
  }

  // ─── Info helpers ────────────────────────────────────────────────────────────

  async infoMemory(): Promise<Record<string, string>> {
    try {
      const raw = await (this.client as Redis).info('memory');
      const pairs: Record<string, string> = {};
      for (const line of raw.split('\r\n')) {
        const [k, ...v] = line.split(':');
        if (k && v.length) pairs[k] = v.join(':');
      }
      return pairs;
    } catch {
      return {};
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory fallback store when Redis is unavailable.
 * Suitable for development and testing only.
 */
class InMemoryStore {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();
  private readonly sortedSets = new Map<string, Map<string, number>>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, mode?: string, ttl?: number): Promise<boolean> {
    const expiresAt = mode === 'EX' && ttl ? Date.now() + ttl * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return true;
  }

  async setnx(key: string, value: string): Promise<number> {
    if (this.store.has(key)) return 0;
    this.store.set(key, { value, expiresAt: null });
    return 1;
  }

  async setnxWithTTL(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (this.store.has(key)) return false;
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
      this.sortedSets.delete(k);
    }
    return count;
  }

  async exists(key: string): Promise<number> {
    const val = await this.get(key);
    return val !== null ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    return this.incrby(key, 1);
  }

  async incrby(key: string, increment: number): Promise<number> {
    const current = await this.get(key);
    const next = (parseInt(current ?? '0', 10) + increment).toString();
    const entry = this.store.get(key);
    this.store.set(key, { value: next, expiresAt: entry?.expiresAt ?? null });
    return parseInt(next, 10);
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map((k) => this.get(k)));
  }

  async mset(...keyValuePairs: string[]): Promise<void> {
    for (let i = 0; i < keyValuePairs.length; i += 2) {
      await this.set(keyValuePairs[i], keyValuePairs[i + 1]);
    }
  }

  // Hash helpers
  async hget(key: string, field: string): Promise<string | null> {
    const entry = this.store.get(`${key}:${field}`);
    return entry?.value ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    this.store.set(`${key}:${field}`, { value, expiresAt: null });
    return 1;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const [k, entry] of this.store.entries()) {
      if (k.startsWith(`${key}:`)) {
        result[k.slice(key.length + 1)] = entry.value;
      }
    }
    return result;
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    const current = (await this.hget(key, field)) ?? '0';
    const next = parseInt(current, 10) + increment;
    await this.hset(key, field, next.toString());
    return next;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    let count = 0;
    for (const f of fields) {
      if (this.store.delete(`${key}:${f}`)) count++;
    }
    return count;
  }

  // Sorted set helpers
  async zadd(key: string, score: number, member: string): Promise<number> {
    let ss = this.sortedSets.get(key);
    if (!ss) { ss = new Map(); this.sortedSets.set(key, ss); }
    const isNew = !ss.has(member);
    ss.set(member, score);
    return isNew ? 1 : 0;
  }

  async zincrby(key: string, increment: number, member: string): Promise<string> {
    let ss = this.sortedSets.get(key);
    if (!ss) { ss = new Map(); this.sortedSets.set(key, ss); }
    const current = ss.get(member) ?? 0;
    const next = current + increment;
    ss.set(member, next);
    return next.toString();
  }

  async zscore(key: string, member: string): Promise<string | null> {
    const score = this.sortedSets.get(key)?.get(member);
    return score !== undefined ? score.toString() : null;
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    const ss = this.sortedSets.get(key);
    if (!ss) return [];
    const entries = [...ss.entries()].sort((a, b) => b[1] - a[1]);
    const end = stop < 0 ? entries.length : stop + 1;
    return entries.slice(start, end).flatMap(([member, score]) => [member, score.toString()]);
  }

  async zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]> {
    const ss = this.sortedSets.get(key);
    if (!ss) return [];
    const minVal = typeof min === 'number' ? min : parseFloat(min);
    const maxVal = typeof max === 'number' ? max : parseFloat(max);
    return [...ss.entries()]
      .filter(([, score]) => score >= minVal && score <= maxVal)
      .sort((a, b) => a[1] - b[1])
      .flatMap(([member, score]) => [member, score.toString()]);
  }

  async zcard(key: string): Promise<number> {
    return this.sortedSets.get(key)?.size ?? 0;
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    const ss = this.sortedSets.get(key);
    if (!ss) return 0;
    let count = 0;
    for (const m of members) { if (ss.delete(m)) count++; }
    return count;
  }
}