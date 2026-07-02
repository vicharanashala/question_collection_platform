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
        next: () => this.invalidate(patterns),
        error: (err) => this.logger.debug(`CacheInvalidationInterceptor: not invalidating on error: ${err.message}`),
      }),
    );
  }

  private async invalidate(patterns: string[]): Promise<void> {
    try {
      for (const pattern of patterns) {
        const count = await this.redis.delByPattern(pattern);
        if (count > 0) {
          this.logger.debug(`CacheInvalidationInterceptor: flushed ${count} keys matching "${pattern}"`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`CacheInvalidationInterceptor: failed to invalidate: ${err.message}`);
    }
  }
}