import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { queryKey } from './cache.keys';
import { CacheTTL } from '../config/cache-ttl.constants';

/**
 * Generic query cache with get-or-set semantics.
 * Use for expensive aggregation queries whose results can be cached.
 */
@Injectable()
export class QueryCacheService {
  private readonly logger = new Logger(QueryCacheService.name);
  private readonly ttl: number;
  private readonly maxPayloadBytes = 1024 * 1024; // 1 MB

  constructor(
    private readonly redis: RedisService,
  ) {
    this.ttl = CacheTTL.QUERY_CACHE;
  }

  /**
   * Get cached result or execute the fetcher and cache the result.
   *
   * @param name   Query identifier (e.g. 'leaderboard:weekly')
   * @param params Unique params hash (e.g. 'state:KA')
   * @param ttl    Optional TTL override in seconds.
   * @param fetcher  Async function that returns the fresh data.
   */
  async getOrSet<T>(
    name: string,
    params: string,
    fetcher: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const key = queryKey(name, params);
    const effectiveTtl = ttl ?? this.ttl;

    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        if (Math.random() < 0.01) this.logger.debug(`[QueryCache] HIT key=${key}`);
        return JSON.parse(cached) as T;
      }
    } catch {
      // Redis unavailable or parse failure — fall through to fetcher
    }

    const data = await fetcher();
    const serialized = JSON.stringify(data);

    if (serialized.length <= this.maxPayloadBytes) {
      await this.redis.set(key, serialized, effectiveTtl).catch((err) => {
        this.logger.warn(`[QueryCache] set failed for key=${key}: ${err.message}`);
      });
    } else {
      this.logger.warn(`[QueryCache] payload too large (${serialized.length} bytes) — not caching key=${key}`);
    }

    return data;
  }

  /** Invalidate all cached results for a given query name. */
  async invalidateQuery(queryName: string): Promise<number> {
    return this.redis.delByPattern(`query:${queryName}:*`);
  }

  /** Invalidate all query caches (e.g. after a major data migration). */
  async invalidateAll(): Promise<number> {
    return this.redis.delByPattern('query:*');
  }
}