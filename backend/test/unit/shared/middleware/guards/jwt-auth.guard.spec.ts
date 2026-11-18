import { HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../../../src/shared/middleware/guards/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../../../../../src/shared/middleware/decorators/public.decorator';
import { IS_SKIP_JWT_KEY } from '../../../../../src/modules/auth/decorators/skip-jwt-auth.decorator';
import { UserAccountLockedException } from '../../../../../src/shared/classes/exceptions/user-status.exception';
import { VerificationStatus } from '../../../../../src/shared/classes/enums';
import { createHttpContext } from '../../../../helpers/execution-context';

// Returns the error thrown by fn, or undefined when it does not throw.
function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
}

describe('JwtAuthGuard', () => {
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(reflector);
  const context = createHttpContext();

  describe('canActivate', () => {
    it('lets @Public() routes through without a token', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === IS_PUBLIC_KEY);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('lets @SkipJwtAuth() routes through without a token', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === IS_SKIP_JWT_KEY);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('handleRequest', () => {
    const activeUser = { id: 'u1', mobileNumber: '+919876543210', role: 'user', verificationStatus: VerificationStatus.VERIFIED };

    it('returns the user for an active account', () => {
      expect(guard.handleRequest(null, activeUser, undefined, context, undefined)).toBe(activeUser);
    });

    it('throws 401 when passport found no user', () => {
      expect(() => guard.handleRequest(null, false, undefined, context, undefined)).toThrow(UnauthorizedException);
    });

    it('rethrows the strategy error as is', () => {
      const error = new UnauthorizedException('Session expired. Please login again.');

      expect(() => guard.handleRequest(error, false, undefined, context, undefined)).toThrow(error);
    });

    it('throws 423 with suspension details for suspended accounts', () => {
      const suspendedUntil = new Date('2026-12-01T00:00:00Z');
      const user = { ...activeUser, verificationStatus: VerificationStatus.SUSPENDED, suspendedReason: 'Spam', suspendedUntil };

      const locked = captureError(() => guard.handleRequest(null, user, undefined, context, undefined));

      expect(locked).toBeInstanceOf(UserAccountLockedException);
      expect((locked as UserAccountLockedException).getStatus()).toBe(HttpStatus.LOCKED);
      expect((locked as UserAccountLockedException).getResponse()).toEqual(
        expect.objectContaining({ status: VerificationStatus.SUSPENDED, reason: 'Spam', suspendedUntil, bannedAt: null }),
      );
    });

    it('throws 423 with ban details for banned accounts', () => {
      const bannedAt = new Date('2026-10-01T00:00:00Z');
      const user = { ...activeUser, verificationStatus: VerificationStatus.BANNED, bannedReason: 'Abuse', bannedAt };

      expect(() => guard.handleRequest(null, user, undefined, context, undefined)).toThrow(UserAccountLockedException);
    });
  });
});
