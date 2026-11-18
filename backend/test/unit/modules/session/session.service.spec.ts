import { createHash } from 'crypto';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SessionService } from '../../../../src/modules/session/services/session.service';
import { REPOSITORY_TOKENS } from '../../../../src/shared/database/repositories';
import { createMockRepository } from '../../../helpers/mock-repository';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const FIVE_MINUTES = 5 * 60 * 1000;

describe('SessionService', () => {
  const sessionRepo = createMockRepository(
    'upsertForUser',
    'findActiveBySessionId',
    'findActiveWithRefreshHash',
    'touchActivity',
    'deleteBySessionId',
    'deleteByUserId',
    'listActiveSessions',
    'findActiveByUserIds',
  );
  let service: SessionService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SessionService, { provide: REPOSITORY_TOKENS.Session, useValue: sessionRepo }],
    }).compile();
    service = moduleRef.get(SessionService);
    sessionRepo.touchActivity.mockResolvedValue(undefined);
  });

  describe('create', () => {
    it('stores only a hash of the refresh token', async () => {
      const expiresAt = new Date('2026-12-01T00:00:00Z');

      await service.create({ sessionId: 'sid', userId: 'u1', refreshToken: 'refresh-token', expiresAt, meta: { device: 'mobile' } });

      expect(sessionRepo.upsertForUser).toHaveBeenCalledWith({
        sessionId: 'sid',
        userId: 'u1',
        refreshTokenHash: sha256('refresh-token'),
        expiresAt,
        meta: { device: 'mobile' },
      });
      expect(JSON.stringify(sessionRepo.upsertForUser.mock.calls)).not.toContain('"refresh-token"');
    });
  });

  describe('validateAccess', () => {
    it('returns the active session', async () => {
      const session = { sessionId: 'sid', lastActivityAt: new Date() };
      sessionRepo.findActiveBySessionId.mockResolvedValue(session);

      await expect(service.validateAccess('sid', 'u1')).resolves.toBe(session);
      expect(sessionRepo.findActiveBySessionId).toHaveBeenCalledWith('sid', 'u1');
    });

    it('rejects with SESSION_REVOKED when the session is gone', async () => {
      sessionRepo.findActiveBySessionId.mockResolvedValue(null);

      await expect(service.validateAccess('sid', 'u1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SESSION_REVOKED' }),
      });
    });

    it('fails closed with 503 (not 401) when the store is unavailable', async () => {
      sessionRepo.findActiveBySessionId.mockRejectedValue(new Error('connection reset'));

      await expect(service.validateAccess('sid', 'u1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('does not touch recently active sessions', async () => {
      sessionRepo.findActiveBySessionId.mockResolvedValue({ lastActivityAt: new Date() });

      await service.validateAccess('sid', 'u1');

      expect(sessionRepo.touchActivity).not.toHaveBeenCalled();
    });

    it('touches sessions idle for more than five minutes', async () => {
      sessionRepo.findActiveBySessionId.mockResolvedValue({ lastActivityAt: new Date(Date.now() - FIVE_MINUTES - 1000) });

      await service.validateAccess('sid', 'u1');

      expect(sessionRepo.touchActivity).toHaveBeenCalledWith('sid');
    });

    it('does not fail the request when touching the session fails', async () => {
      sessionRepo.findActiveBySessionId.mockResolvedValue({ lastActivityAt: new Date(0) });
      sessionRepo.touchActivity.mockRejectedValue(new Error('write failed'));

      await expect(service.validateAccess('sid', 'u1')).resolves.toBeDefined();
    });
  });

  describe('validateRefresh', () => {
    it('accepts the refresh token that matches the stored hash', async () => {
      const session = { refreshTokenHash: sha256('good-token') };
      sessionRepo.findActiveWithRefreshHash.mockResolvedValue(session);

      await expect(service.validateRefresh('sid', 'u1', 'good-token')).resolves.toBe(session);
    });

    it('rejects a different refresh token (stolen or replayed after rotation)', async () => {
      sessionRepo.findActiveWithRefreshHash.mockResolvedValue({ refreshTokenHash: sha256('good-token') });

      await expect(service.validateRefresh('sid', 'u1', 'other-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the stored hash is corrupt', async () => {
      sessionRepo.findActiveWithRefreshHash.mockResolvedValue({ refreshTokenHash: 'abc' });

      await expect(service.validateRefresh('sid', 'u1', 'good-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects when the session no longer exists', async () => {
      sessionRepo.findActiveWithRefreshHash.mockResolvedValue(null);

      await expect(service.validateRefresh('sid', 'u1', 'good-token')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns 503 when the store is unavailable', async () => {
      sessionRepo.findActiveWithRefreshHash.mockRejectedValue(new Error('timeout'));

      await expect(service.validateRefresh('sid', 'u1', 'good-token')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('revocation', () => {
    it('revokes a single session for logout', async () => {
      sessionRepo.deleteBySessionId.mockResolvedValue(1);

      await expect(service.revoke('sid', 'u1')).resolves.toBe(1);
      expect(sessionRepo.deleteBySessionId).toHaveBeenCalledWith('sid', 'u1');
    });

    it('revokes every session of a user for remote logout', async () => {
      sessionRepo.deleteByUserId.mockResolvedValue(2);

      await expect(service.revokeUser('u1')).resolves.toBe(2);
    });
  });

  describe('getActiveSessionMap', () => {
    it('maps active sessions by user id', async () => {
      sessionRepo.findActiveByUserIds.mockResolvedValue([{ userId: 'u1', device: 'mobile' }]);

      const map = await service.getActiveSessionMap(['u1', 'u2']);

      expect(map.get('u1')).toEqual({ userId: 'u1', device: 'mobile' });
      expect(map.has('u2')).toBe(false);
    });

    it('degrades to an empty map when the lookup fails', async () => {
      sessionRepo.findActiveByUserIds.mockRejectedValue(new Error('boom'));

      await expect(service.getActiveSessionMap(['u1'])).resolves.toEqual(new Map());
    });
  });
});
