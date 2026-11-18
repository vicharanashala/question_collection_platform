import { HttpStatus } from '@nestjs/common';
import { UserAccountLockedException } from '../../../../src/shared/classes/exceptions/user-status.exception';
import { VerificationStatus } from '../../../../src/shared/classes/enums';

describe('UserAccountLockedException', () => {
  it('uses HTTP 423 so clients can tell a locked account from a 403', () => {
    const error = new UserAccountLockedException({
      status: VerificationStatus.BANNED,
      reason: null,
      suspendedAt: null,
      suspendedUntil: null,
      bannedAt: null,
    });

    expect(error.getStatus()).toBe(HttpStatus.LOCKED);
  });

  it('describes a suspension with its period', () => {
    const suspendedAt = new Date('2026-11-01T00:00:00Z');
    const suspendedUntil = new Date('2026-11-08T00:00:00Z');

    const error = new UserAccountLockedException({
      status: VerificationStatus.SUSPENDED,
      reason: 'Duplicate questions',
      suspendedAt,
      suspendedUntil,
      bannedAt: null,
    });

    expect(error.getResponse()).toEqual({
      statusCode: HttpStatus.LOCKED,
      error: 'ACCOUNT_LOCKED',
      message: 'Your account has been suspended',
      status: VerificationStatus.SUSPENDED,
      reason: 'Duplicate questions',
      suspendedAt,
      suspendedUntil,
      bannedAt: null,
    });
  });

  it('describes a permanent ban', () => {
    const error = new UserAccountLockedException({
      status: VerificationStatus.BANNED,
      reason: 'Abuse',
      suspendedAt: null,
      suspendedUntil: null,
      bannedAt: new Date('2026-11-01T00:00:00Z'),
    });

    expect(error.getResponse()).toEqual(expect.objectContaining({ message: 'Your account has been permanently banned', reason: 'Abuse' }));
  });
});
