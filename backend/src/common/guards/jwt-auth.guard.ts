import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_SKIP_JWT_KEY } from '../../auth/decorators/skip-jwt-auth.decorator';
import { VerificationStatus } from '../enums';
import { UserAccountLockedException } from '../exceptions/user-status.exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
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

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser,
    _info: unknown,
    _context: ExecutionContext,
    _status: unknown,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication required');
    }

    // Cast to the extended user object returned by JwtStrategy.validate()
    const u = user as unknown as {
      id: string;
      mobileNumber: string;
      role: string;
      verificationStatus?: VerificationStatus;
      suspendedReason?: string | null;
      suspendedAt?: Date | null;
      suspendedUntil?: Date | null;
      bannedReason?: string | null;
      bannedAt?: Date | null;
    };

    // Throw lock exception here (not in JwtStrategy) so NestJS sets the correct
    // HTTP 423 status code instead of passport converting it to 401.
    if (u.verificationStatus === VerificationStatus.SUSPENDED) {
      throw new UserAccountLockedException({
        status: VerificationStatus.SUSPENDED,
        reason: u.suspendedReason ?? null,
        suspendedAt: u.suspendedAt ?? null,
        suspendedUntil: u.suspendedUntil ?? null,
        bannedAt: null,
      });
    }
    if (u.verificationStatus === VerificationStatus.BANNED) {
      throw new UserAccountLockedException({
        status: VerificationStatus.BANNED,
        reason: u.bannedReason ?? null,
        suspendedAt: null,
        suspendedUntil: null,
        bannedAt: u.bannedAt ?? null,
      });
    }

    return user;
  }
}