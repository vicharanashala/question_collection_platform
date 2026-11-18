import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, JwtStrategy } from '../../../../../src/shared/middleware/guards/jwt.strategy';
import { SessionService } from '../../../../../src/modules/session/services/session.service';
import { VerificationStatus } from '../../../../../src/shared/classes/enums';
import type { IUserRepository } from '../../../../../src/shared/database/repositories';
import { buildUser } from '../../../../helpers/factories';
import { createMockRepository } from '../../../../helpers/mock-repository';

describe('JwtStrategy.validate', () => {
  const userRepo = createMockRepository();
  const sessionService = { validateAccess: jest.fn() };
  const config = { get: () => 'secret' } as unknown as ConfigService;
  const strategy = new JwtStrategy(config, userRepo as unknown as IUserRepository, sessionService as unknown as SessionService);

  const user = buildUser();
  const payload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: user._id.toHexString(),
    mobileNumber: user.mobileNumber,
    role: user.role,
    tokenVersion: user.tokenVersion,
    sid: 'sid-1',
    type: 'access',
    ...overrides,
  });

  beforeEach(() => {
    userRepo.findById.mockResolvedValue({ ...user });
    sessionService.validateAccess.mockResolvedValue({});
  });

  it('returns the request user for a valid access token', async () => {
    await expect(strategy.validate(payload())).resolves.toEqual(
      expect.objectContaining({ id: user._id.toHexString(), sid: 'sid-1', role: user.role, verificationStatus: VerificationStatus.VERIFIED }),
    );
    expect(sessionService.validateAccess).toHaveBeenCalledWith('sid-1', user._id.toHexString());
  });

  it.each([
    ['missing subject', { sub: '' }],
    ['missing mobile number', { mobileNumber: '' }],
    ['non ObjectId subject', { sub: 'not-an-object-id' }],
  ])('rejects a token with %s', async (_case, overrides) => {
    await expect(strategy.validate(payload(overrides))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(userRepo.findById).not.toHaveBeenCalled();
  });

  it.each([
    ['refresh token', { type: 'refresh' as const }],
    ['registration token', { type: 'registration' as const }],
    ['token without a session id', { sid: undefined }],
  ])('rejects a %s used as an access token', async (_case, overrides) => {
    await expect(strategy.validate(payload(overrides))).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'SESSION_REVOKED' }),
    });
  });

  it('rejects tokens for users that no longer exist', async () => {
    userRepo.findById.mockResolvedValue(null);

    await expect(strategy.validate(payload())).rejects.toThrow('User not found');
  });

  it('rejects tokens for deleted accounts', async () => {
    userRepo.findById.mockResolvedValue({ ...user, isDeleted: true });

    await expect(strategy.validate(payload())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'ACCOUNT_DELETED' }),
    });
  });

  it('propagates a revoked session from the session service', async () => {
    sessionService.validateAccess.mockRejectedValue(new UnauthorizedException());

    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('propagates a 503 when the session store is unavailable', async () => {
    sessionService.validateAccess.mockRejectedValue(new ServiceUnavailableException());

    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects tokens issued before the last logout (tokenVersion mismatch)', async () => {
    await expect(strategy.validate(payload({ tokenVersion: user.tokenVersion - 1 }))).rejects.toThrow(
      'Session expired. Please login again.',
    );
  });

  it('reinstates a user whose suspension has expired', async () => {
    userRepo.findById.mockResolvedValue({
      ...user,
      verificationStatus: VerificationStatus.SUSPENDED,
      suspendedUntil: new Date(Date.now() - 60_000),
    });

    const result = await strategy.validate(payload());

    expect(userRepo.update).toHaveBeenCalledWith(user._id.toString(), {
      verificationStatus: VerificationStatus.VERIFIED,
      suspendedAt: null,
      suspendedUntil: null,
      suspendedReason: null,
    });
    expect(result.verificationStatus).toBe(VerificationStatus.VERIFIED);
  });

  it('keeps an active suspension so the guard can return 423', async () => {
    userRepo.findById.mockResolvedValue({
      ...user,
      verificationStatus: VerificationStatus.SUSPENDED,
      suspendedUntil: new Date(Date.now() + 60_000),
    });

    const result = await strategy.validate(payload());

    expect(userRepo.update).not.toHaveBeenCalled();
    expect(result.verificationStatus).toBe(VerificationStatus.SUSPENDED);
  });
});
