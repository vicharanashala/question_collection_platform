import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Guard that authenticates requests via a static API key sent in the
 * `x-api-key` header. Intended for service-to-service calls from
 * external projects that don't have a user JWT.
 *
 * The expected key is read from the `ANVESHAN_ANNADATHA_AUTH_KEY` env var.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string | undefined;

    const expectedKey = process.env.ANVESHAN_ANNADATHA_AUTH_KEY;
    if (!expectedKey) {
      throw new UnauthorizedException('API key authentication is not configured');
    }

    if (!apiKey) {
      throw new UnauthorizedException('Missing x-api-key header');
    }

    // Timing-safe comparison to prevent timing attacks
    const keyBuffer = Buffer.from(apiKey);
    const expectedBuffer = Buffer.from(expectedKey);

    if (
      keyBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(keyBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
