import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis service wrapper for rate-limiting, caching, session management, and more.
 *
 * Redis is a required dependency — the app will crash on startup if it cannot connect.
 * Use Docker Compose `depends_on: condition: service_healthy` to gate startup.
 */
@Injectable()
export class RedisService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  // ─── Circuit breaker state ────────────────────────────────────────────────
  private readonly CIRCUIT_FAILURE_THRESHOLD = 5;   // open after 5 consecutive failures
  private readonly CIRCUIT_RECOVERY_TIMEOUT_MS = 30_000; // try again after 30s
  private _circuitFailures = 0;
  private _circuitOpenAt = 0;   // timestamp when circuit opened (0 = closed)
  private _bypassCache = false; // true when circuit is open

  private get circuitOpen(): boolean {
    if (this._circuitOpenAt === 0) return false;
    if (Date.now() - this._circuitOpenAt > this.CIRCUIT_RECOVERY_TIMEOUT_MS) {
      this.logger.log('Circuit breaker: attempting reset after timeout');
      this._circuitOpenAt = 0;
      this._circuitFailures = 0;
      this._bypassCache = false;
      return false;
    }
    return true;
  }

  constructor(private readonly configService: ConfigService) {
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
      redisOpts.tls = {};
    }

    this.client = new Redis(redisOpts);

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
      this._circuitFailures++;
      if (this._circuitFailures >= this.CIRCUIT_FAILURE_THRESHOLD && this._circuitOpenAt === 0) {
        this._circuitOpenAt = Date.now();
        this._bypassCache = true;
        this.logger.warn(
          `Circuit breaker OPEN — Redis disabled for ${this.CIRCUIT_RECOVERY_TIMEOUT_MS / 1000}s after ${this._circuitFailures} failures`,
        );
      }
      // No longer throwing — circuit breaker handles failure gracefully
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis ready');
      // Reset circuit on clean reconnect
      this._circuitFailures = 0;
      this._circuitOpenAt = 0;
      this._bypassCache = false;
    });

    this.client.on('close', () => {
      this.logger.error('Redis connection closed');
      this._circuitFailures++;
      this._bypassCache = true;
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => {/* ignore */});
  }

  // ─── Circuit breaker helpers ────────────────────────────────────────────────

  private recordFailure(err: any): void {
    this._circuitFailures++;
    if (this._circuitFailures >= this.CIRCUIT_FAILURE_THRESHOLD && this._circuitOpenAt === 0) {
      this._circuitOpenAt = Date.now();
      this._bypassCache = true;
      this.logger.warn(
        `Circuit breaker OPEN — Redis disabled for ${this.CIRCUIT_RECOVERY_TIMEOUT_MS / 1000}s after ${this._circuitFailures} failures: ${err.message}`,
      );
    }
  }

  /** Whether cache reads/writes are currently being bypassed due to Redis being down. */
  isBypassed(): boolean {
    return this._bypassCache;
  }

  /** Current circuit state for health monitoring. */
  getCircuitState(): { open: boolean; failures: number; since: number } {
    return {
      open: this.circuitOpen,
      failures: this._circuitFailures,
      since: this._circuitOpenAt,
    };
  }

  /**
   * Register a callback to run every time the Redis client reconnects.
   * Used by CacheWarmupService to re-run warmup on Redis restarts.
   */
  onReconnect(handler: () => void): void {
    this.client.on('reconnecting', handler);
  }

  // ─── Stampede protection ─────────────────────────────────────────────────────

  /**
   * Get a value from cache, or compute and cache it with stampede protection.
   *
   * If the key is missing, only one caller will compute the value (via SETNX lock).
   * All other callers wait and then read the newly cached result.
   *
   * @param key          Redis key
   * @param factory      Async function to compute the value on cache miss
   * @param ttlSeconds   TTL for the cached value
   * @param lockTtlSec   TTL for the lock key (default 30s, prevents deadlock)
   * @param waitMs       How long to wait before re-reading cache (default 100ms)
   */
  async getOrSet<T = string>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number,
    lockTtlSec = 30,
    waitMs = 100,
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) return JSON.parse(cached) as T;

    const lockKey = `lock:${key}`;
    const acquired = await this.setnx(lockKey, '1');

    if (acquired) {
      try {
        // Set expiry on lock so it auto-releases if holder crashes
        await this.client.expire(lockKey, lockTtlSec);
        const value = await factory();
        await this.set(key, JSON.stringify(value), ttlSeconds);
        return value;
      } finally {
        // Release lock — ignore errors if Redis is already closing
        await this.del(lockKey).catch(() => {/* ignore */});
      }
    }

    // Another process is rebuilding — wait and read again
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const retry = await this.get(key);
    if (retry !== null) return JSON.parse(retry) as T;

    // Still missing — fall back to factory (degraded but functional)
    return factory();
  }

  // ─── Core operations ─────────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    if (this.circuitOpen) {
      this.logger.debug(`Circuit open — bypassing Redis GET for "${key}"`);
      return null;
    }
    try {
      const result = await this.client.get(key);
      this._circuitFailures = 0;
      return result;
    } catch (err: any) {
      this.recordFailure(err);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.circuitOpen) {
      this.logger.debug(`Circuit open — bypassing Redis SET for "${key}"`);
      return;
    }
    try {
      if (ttlSeconds !== undefined) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      this._circuitFailures = 0;
    } catch (err: any) {
      this.recordFailure(err);
    }
  }

  /**
   * Set a key only if it does not already exist (NX).
   * Returns true if the key was set, false if it already existed.
   */
  async setnx(key: string, value: string): Promise<boolean> {
    const result = await this.client.setnx(key, value);
    return result === 1;
  }

  /**
   * Set with NX and TTL combined. Returns true if key was set, false if already existed.
   */
  async setnxWithTTL(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK' || result === true;
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async incrby(key: string, increment: number): Promise<number> {
    return this.client.incrby(key, increment);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async dbsize(): Promise<number> {
    return this.client.dbsize();
  }

  // ─── Batch helpers ───────────────────────────────────────────────────────────

  async mget(...keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return this.client.mget(...keys);
  }

  async mset(...keyValuePairs: string[]): Promise<void> {
    if (keyValuePairs.length === 0) return;
    await this.client.mset(...keyValuePairs);
  }

  // ─── Pipeline ────────────────────────────────────────────────────────────────

  pipeline(): RedisPipeline {
    return new Pipeline(this.client.pipeline());
  }

  /**
   * Execute an arbitrary Lua script.
   *
   * @param script  Lua script source
   * @param keys    Number of key arguments
   * @param args    Script arguments (e.g. for decrementLeaderboardScore: key, deltaStr, member)
   */
  async eval(
    script: string,
    keys: number,
    ...args: [key: string, deltaStr: string, member: string]
  ): Promise<unknown> {
    return this.client.eval(script, keys, ...args);
  }

  // ─── Hash helpers ────────────────────────────────────────────────────────────

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    return this.client.hincrby(key, field, increment);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields);
  }

  // ─── Sorted set helpers ──────────────────────────────────────────────────────

  async zadd(key: string, score: number, member: string): Promise<number> {
    return this.client.zadd(key, score, member);
  }

  async zincrby(key: string, increment: number, member: string): Promise<string> {
    return this.client.zincrby(key, increment, member);
  }

  async zscore(key: string, member: string): Promise<string | null> {
    return this.client.zscore(key, member);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.client.zrevrange(key, start, stop);
  }

  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]> {
    return this.client.zrangebyscore(key, min, max);
  }

  async zcard(key: string): Promise<number> {
    return this.client.zcard(key);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.client.zrem(key, ...members);
  }

  // ─── Scan helpers ────────────────────────────────────────────────────────────

  /**
   * Scan keys matching a pattern. Stops early if countLimit is reached.
   * Use sparingly in production — prefer specific key patterns.
   *
   * @param pattern    Redis SCAN pattern (e.g. 'session:*')
   * @param count      Redis SCAN COUNT hint per iteration (default 100)
   * @param limitLimit Maximum total keys to collect (default unlimited).
   *                   When reached the scan ends early.
   */
  async scan(pattern: string, count = 100, limitLimit?: number): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', count);
      cursor = nextCursor;
      keys.push(...batch);
      if (limitLimit !== undefined && keys.length >= limitLimit) {
        return keys.slice(0, limitLimit);
      }
    } while (cursor !== '0');
    return keys;
  }

  /**
   * Delete all keys matching a pattern (for cache flush).
   */
  async delByPattern(pattern: string, limit?: number): Promise<number> {
    const keys = await this.scan(pattern, 100, limit);
    if (keys.length === 0) return 0;
    return this.del(...keys);
  }

  // ─── Info helpers ────────────────────────────────────────────────────────────

  async infoMemory(): Promise<Record<string, string>> {
    const info = await this.client.info('memory');
    const result: Record<string, string> = {};
    for (const line of info.split('\r\n')) {
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      result[line.slice(0, idx)] = line.slice(idx + 1);
    }
    return result;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Shared interface implemented by Pipeline and any future variants. */
interface RedisPipeline {
  set(key: string, value: string, ttlSeconds?: number): this;
  hset(key: string, field: string, value: string): this;
  zadd(key: string, score: number, member: string): this;
  del(key: string): this;
  expire(key: string, seconds: number): this;
  exec(): Promise<void>;
}

/** Wraps ioredis.pipeline() with a clean fluent interface. */
class Pipeline implements RedisPipeline {
  constructor(private readonly _pipeline: ReturnType<Redis['pipeline']>) {}

  set(key: string, value: string, ttlSeconds?: number): this {
    if (ttlSeconds !== undefined) {
      this._pipeline.set(key, value, 'EX', ttlSeconds);
    } else {
      this._pipeline.set(key, value);
    }
    return this;
  }

  hset(key: string, field: string, value: string): this {
    this._pipeline.hset(key, field, value);
    return this;
  }

  zadd(key: string, score: number, member: string): this {
    this._pipeline.zadd(key, score, member);
    return this;
  }

  del(key: string): this {
    this._pipeline.del(key);
    return this;
  }

  expire(key: string, seconds: number): this {
    this._pipeline.expire(key, seconds);
    return this;
  }

  async exec(): Promise<void> {
    await this._pipeline.exec();
  }
}