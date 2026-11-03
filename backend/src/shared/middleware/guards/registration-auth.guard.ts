import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Guard that accepts the short-lived registration `tempToken` issued by
 * `verifyOtp` for first-time users. The token has shape
 *   { sub: userId, mobileNumber, type: 'registration' }
 * and no `tokenVersion`, so the regular JwtAuthGuard rejects it.
 *
 * On success, sets `request.user = { id, mobileNumber }`.
 *
 * Used by endpoints that require a valid registration token (e.g. POST /auth/register).
 */
@Injectable()
export class RegistrationAuthGuard {
  constructor(
    private readonly jwtService: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
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
