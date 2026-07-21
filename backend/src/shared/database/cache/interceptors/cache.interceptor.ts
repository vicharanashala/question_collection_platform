import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../redis.service';
import { CACHE_TTL_KEY, CACHE_KEY_PREFIX_KEY } from '../decorators/cacheable.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const cacheMeta = this.reflector.get(CACHE_TTL_KEY, context.getHandler());
    if (!cacheMeta) return next.handle();

    const { keyPrefix, ttlSeconds } = cacheMeta;
    const request = context.switchToHttp().getRequest();
    const key = this.buildKey(keyPrefix, request);

    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        // Sample 1% of hits for observability
        if (Math.random() < 0.01) {
          this.logger.debug(`[CacheInterceptor] HIT key=${key}`);
        }
        const response = context.switchToHttp().getResponse();
        response.setHeader('X-Cache', 'HIT');
        response.setHeader('X-Cache-Key', key);
        response.setHeader('X-Cache-TTL', String(ttlSeconds));
        return of(JSON.parse(cached));
      }
    } catch (err: any) {
      this.logger.warn(`[CacheInterceptor] Redis get failed: ${err.message} — bypassing cache`);
      return next.handle();
    }

    this.logger.debug(`[CacheInterceptor] MISS key=${key}`);
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-Cache', 'MISS');
    response.setHeader('X-Cache-Key', key);

    return next.handle().pipe(
      tap((data) => {
        // Only cache successful non-null responses under 1 MB
        if (data === null || data === undefined) return;
        const serialized = JSON.stringify(data);
        if (serialized.length > 1024 * 1024) {
          this.logger.warn(`[CacheInterceptor] Payload too large to cache (${serialized.length} bytes) key=${key}`);
          return;
        }
        this.redis.set(key, serialized, ttlSeconds).catch((err) => {
          this.logger.warn(`[CacheInterceptor] Redis set failed: ${err.message}`);
        });
      }),
    );
  }

  private buildKey(keyPrefix: string | ((args: unknown[]) => string), request: unknown): string {
    if (typeof keyPrefix === 'function') {
      const args = (request as Record<string, unknown>).params ?? (request as Record<string, unknown>).query ?? {};
      return keyPrefix(Object.values(args));
    }
    // Include userId in key for user-scoped caches
    const user = (request as Record<string, unknown>).user;
    const userPart = user ? `:u${(user as { id: number }).id}` : '';
    const queryPart = this.buildQueryPart(request as Record<string, unknown>);
    return `http:${keyPrefix}${userPart}${queryPart}`;
  }

  private buildQueryPart(request: Record<string, unknown>): string {
    const query = request.query as Record<string, unknown> | undefined;
    if (!query || Object.keys(query).length === 0) return '';
    // Skip page > 1 from cache (paginated endpoints should handle this in keyPrefix)
    const filtered = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('&');
    return filtered ? `:?${filtered}` : '';
  }
}