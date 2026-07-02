import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { RedisService } from '../redis.service';
import { rateLimitKey } from '../cache.keys';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitMeta = this.reflector.get('rate_limit', context.getHandler());
    if (!rateLimitMeta) return true;

    const { limit, windowSeconds, keyPrefix } = rateLimitMeta;
    const request = context.switchToHttp().getRequest() as Request;
    const response = context.switchToHttp().getResponse() as Response;

    const key = this.buildKey(keyPrefix, request, limit, windowSeconds);
    const ttl = windowSeconds;

    try {
      const current = await this.redis.incr(key);

      // Set TTL on first request in the window
      if (current === 1) {
        await this.redis.expire(key, ttl);
      }

      // Expose remaining in headers
      response.setHeader('X-RateLimit-Limit', String(limit));
      response.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - current)));
      response.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + ttl));

      if (current > limit) {
        response.setHeader('Retry-After', String(ttl));
        throw new HttpException(
          'Too many requests. Please slow down.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      // If Redis fails, allow the request (fail open)
      this.logger.warn(`[RateLimitGuard] Redis error: ${(err as Error).message} — allowing request`);
      return true;
    }
  }

  private buildKey(
    keyPrefix: string | ((args: Record<string, unknown>) => string) | undefined,
    request: Request,
    limit: number,
    windowSeconds: number,
  ): string {
    if (typeof keyPrefix === 'function') {
      const args: Record<string, unknown> = {
        ...request.params,
        ...request.query,
        body: request.body,
        user: (request as Request & { user?: { id: number } }).user,
      };
      return keyPrefix(args);
    }

    const action = keyPrefix ?? this.inferAction(request);

    // Use IP for unauthenticated routes, userId for authenticated ones
    const identifier = this.getIdentifier(request);
    return rateLimitKey(action, identifier);
  }

  private inferAction(request: Request): string {
    const m = request.method.toUpperCase();
    const p = request.path;
    return `${m}:${p}`.replace(/\//g, ':').replace(/^:/, '');
  }

  private getIdentifier(request: Request): string {
    // Authenticated user
    const user = (request as Request & { user?: { id: number } }).user;
    if (user?.id) return `u${user.id}`;

    // Fall back to IP (X-Forwarded-For for proxied requests)
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const forwarded = request.headers['x-forwarded-for'];
    const realIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : ip;
    return `ip:${realIp}`;
  }
}