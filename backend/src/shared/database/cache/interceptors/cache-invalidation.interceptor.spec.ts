import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { CacheInvalidationInterceptor } from './cache-invalidation.interceptor';
import { RedisService } from '../redis.service';

describe('CacheInvalidationInterceptor', () => {
  const context = { getHandler: () => ({}) } as unknown as ExecutionContext;
  const reflector = { get: jest.fn() } as unknown as Reflector;
  let events: string[];
  let redis: { delByPattern: jest.Mock };
  let interceptor: CacheInvalidationInterceptor;

  beforeEach(() => {
    events = [];
    redis = {
      delByPattern: jest.fn(async (pattern: string) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        events.push(`deleted ${pattern}`);
        return 1;
      }),
    };
    (reflector.get as jest.Mock).mockReturnValue(['anveshan_milestone*']);
    interceptor = new CacheInvalidationInterceptor(redis as unknown as RedisService, reflector);
  });

  it('finishes invalidating before the response is emitted', async () => {
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    const result = await firstValueFrom(interceptor.intercept(context, handler));
    events.push('responded');

    expect(result).toEqual({ ok: true });
    expect(events).toEqual(['deleted anveshan_milestone*', 'deleted http:anveshan_milestone*', 'responded']);
  });

  it('does not invalidate when the handler fails', async () => {
    const handler: CallHandler = { handle: () => throwError(() => new Error('write failed')) };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).rejects.toThrow('write failed');
    expect(redis.delByPattern).not.toHaveBeenCalled();
  });
});
