import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_SKIP_JWT_KEY } from '../../../modules/auth/decorators/skip-jwt-auth.decorator';

/**
 * Guard that accepts the short-lived registration `tempToken` issued by
 * `verifyOtp` for first-time users. The token has shape
 *   { sub: userId, mobileNumber, type: 'registration' }
 * and no `tokenVersion`, so the regular JwtAuthGuard rejects it.
 *
 * On success, sets `request.user = { id, mobileNumber }`.
 *
 * Used by the `/auth/register/draft` endpoints that let the wizard
 * save partial profile fields while the user is still mid-registration.
 */
@Injectable()
export class RegistrationAuthGuard {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isSkipJwt = this.reflector.getAllAndOverride<boolean>(IS_SKIP_JWT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isSkipJwt) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: unknown;
    }>();

    const auth = req.headers['authorization'] ?? req.headers['Authorization'];
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = auth.slice('Bearer '.length).trim();
    let payload: { sub?: string; mobileNumber?: string; type?: string };
    try {
      payload = this.jwtService.verify<typeof payload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired registration token');
    }

    if (payload.type !== 'registration') {
      throw new UnauthorizedException('Token is not a registration token');
    }
    if (!payload.sub || !payload.mobileNumber) {
      throw new UnauthorizedException('Registration token is missing required claims');
    }

    req.user = { id: payload.sub, mobileNumber: payload.mobileNumber };
    return true;
  }
}