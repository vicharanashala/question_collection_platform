import { HttpException, HttpStatus } from '@nestjs/common';
import { VerificationStatus } from '../enums';

export interface UserStatusPayload {
  status: VerificationStatus;
  reason: string | null;
  suspendedAt: Date | null;
  suspendedUntil: Date | null;
  bannedAt: Date | null;
}

/**
 * Thrown when a suspended or banned user attempts to log in.
 * Uses 423 (Locked) so the mobile client can distinguish it from
 * a generic 403 without parsing the response body.
 */
export class UserAccountLockedException extends HttpException {
  constructor(payload: UserStatusPayload) {
    super(
      {
        statusCode: HttpStatus.LOCKED,
        error: 'ACCOUNT_LOCKED',
        message: payload.status === VerificationStatus.SUSPENDED
          ? 'Your account has been suspended'
          : 'Your account has been permanently banned',
        status: payload.status,
        reason: payload.reason ?? null,
        suspendedAt: payload.suspendedAt,
        suspendedUntil: payload.suspendedUntil,
        bannedAt: payload.bannedAt,
      },
      HttpStatus.LOCKED,
    );
  }
}