import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../redis.service';

@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInvalidationInterceptor.name);

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const patterns = this.reflector.get<string[]>('cache_invalidate_patterns', context.getHandler());
    if (!patterns || patterns.length === 0) return next.handle();

    return next.handle().pipe(
      tap({
        // Only invalidate on success — don't touch cache if the mutation failed.
        next: () => this.invalidate(patterns),
        // Surface unexpected errors without swallowing them.
        error: (err) =>
          this.logger.warn(
            `CacheInvalidationInterceptor: not invalidating on handler error: ${err.message}`,
          ),
      }),
    );
  }

  private async invalidate(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      // Prefix with 'http:' so patterns match what CacheInterceptor actually writes.
      // Raw prefixes like 'meta:*', 'wallet:*', 'leaderboard:top_users' still work —
      // they clear non-HTTP Redis keys (sorted sets, metadata, etc.) alongside the HTTP caches.
      const httpPattern = `http:${pattern}`;
      for (const p of [pattern, httpPattern]) {
        try {
          const count = await this.redis.delByPattern(p);
          if (count > 0) {
            this.logger.debug(`CacheInvalidationInterceptor: flushed ${count} keys matching "${p}"`);
          }
        } catch (err: any) {
          this.logger.warn(`CacheInvalidationInterceptor: failed to invalidate pattern "${p}": ${err.message}`);
        }
      }
    }
  }
}