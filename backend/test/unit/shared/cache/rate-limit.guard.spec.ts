import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from '../../../../src/shared/database/cache/guards/rate-limit.guard';
import type { RateLimitCounterService } from '../../../../src/shared/database/cache/rate-limit-counter.service';
import type { RateLimitMeta } from '../../../../src/shared/database/cache/decorators/rate-limit.decorator';
import { createHttpContext } from '../../../helpers/execution-context';

describe('RateLimitGuard', () => {
  const counter = { hit: jest.fn() };
  const reflector = new Reflector();
  const guard = new RateLimitGuard(counter as unknown as RateLimitCounterService, reflector);

  const setMeta = (meta: RateLimitMeta | undefined) => jest.spyOn(reflector, 'get').mockReturnValue(meta);

  const httpContext = (request: Record<string, unknown> = {}) =>
    createHttpContext({
      request: { method: 'POST', path: '/questions', ip: '10.0.0.1', socket: {}, params: {}, query: {}, headers: {}, ...request },
    });

  const responseOf = (context: ReturnType<typeof httpContext>) =>
    context.switchToHttp().getResponse<{ setHeader: jest.Mock }>();

  it('skips handlers without @RateLimit', async () => {
    setMeta(undefined);

    await expect(guard.canActivate(httpContext())).resolves.toBe(true);
    expect(counter.hit).not.toHaveBeenCalled();
  });

  it('allows requests under the limit and exposes rate limit headers', async () => {
    setMeta({ limit: 5, windowSeconds: 60 });
    counter.hit.mockResolvedValue({ count: 2, ttlSeconds: 30 });
    const context = httpContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);

    const response = responseOf(context);
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '3');
  });

  it('allows the request that exactly reaches the limit', async () => {
    setMeta({ limit: 3, windowSeconds: 60 });
    counter.hit.mockResolvedValue({ count: 3, ttlSeconds: 10 });

    await expect(guard.canActivate(httpContext())).resolves.toBe(true);
  });

  it('rejects with 429 and Retry-After once the limit is exceeded', async () => {
    setMeta({ limit: 3, windowSeconds: 60 });
    counter.hit.mockResolvedValue({ count: 4, ttlSeconds: 42 });
    const context = httpContext();

    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(responseOf(context).setHeader).toHaveBeenCalledWith('Retry-After', '42');
    expect(responseOf(context).setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
  });

  it('keys authenticated requests by user id', async () => {
    setMeta({ limit: 5, windowSeconds: 60 });
    counter.hit.mockResolvedValue({ count: 1, ttlSeconds: 60 });

    await guard.canActivate(httpContext({ user: { id: 'user-7' } }));

    expect(counter.hit).toHaveBeenCalledWith('ratelimit:POST::questions:uuser-7', 60);
  });

  it('keys anonymous requests by the first X-Forwarded-For address', async () => {
    setMeta({ limit: 5, windowSeconds: 60, keyPrefix: 'otp' });
    counter.hit.mockResolvedValue({ count: 1, ttlSeconds: 60 });

    await guard.canActivate(httpContext({ headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' } }));

    expect(counter.hit).toHaveBeenCalledWith('ratelimit:otp:ip:203.0.113.9', 60);
  });

  it('builds dynamic keys from the request body', async () => {
    setMeta({ limit: 3, windowSeconds: 60, keyPrefix: (ctx) => `otp:${(ctx.body as { mobileNumber: string }).mobileNumber}` });
    counter.hit.mockResolvedValue({ count: 1, ttlSeconds: 60 });

    await guard.canActivate(httpContext({ body: { mobileNumber: '9876543210' } }));

    expect(counter.hit).toHaveBeenCalledWith('otp:9876543210', 60);
  });

  it('fails open when the counter store errors', async () => {
    setMeta({ limit: 1, windowSeconds: 60 });
    counter.hit.mockRejectedValue(new Error('redis down'));

    await expect(guard.canActivate(httpContext())).resolves.toBe(true);
  });

  it('never swallows its own 429', async () => {
    setMeta({ limit: 1, windowSeconds: 60 });
    counter.hit.mockResolvedValue({ count: 2, ttlSeconds: 0 });
    const context = httpContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);
    expect(responseOf(context).setHeader).toHaveBeenCalledWith('Retry-After', '60');
  });
});
