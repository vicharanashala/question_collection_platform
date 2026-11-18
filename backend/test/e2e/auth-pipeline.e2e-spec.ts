import * as request from 'supertest';
import { ReportsController } from '../../src/modules/reports/controllers/reports.controller';
import { ReportsService } from '../../src/modules/reports/services/reports.service';
import { AuditService } from '../../src/modules/audit-logs/services/audit.service';
import { UnauthorizedException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { VerificationStatus } from '../../src/shared/classes/enums';
import { buildUser } from '../helpers/factories';
import { createTestApp, TestApp, TEST_SESSION_ID } from '../helpers/test-app';

// Uses GET /reports/my as a representative protected route to exercise the full
// authentication pipeline: bearer extraction, signature, strategy checks and guard.
describe('Authentication pipeline (e2e)', () => {
  const reportsService = { getMyReports: jest.fn() };
  let testApp: TestApp;
  const user = buildUser();

  beforeAll(async () => {
    testApp = await createTestApp({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: reportsService },
        { provide: AuditService, useValue: { createAuditLog: jest.fn() } },
        Logger,
      ],
    });
  });
  afterAll(() => testApp.close());

  beforeEach(() => {
    testApp.userRepo.findById.mockResolvedValue({ ...user });
    testApp.sessionService.validateAccess.mockResolvedValue({});
    reportsService.getMyReports.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, pages: 0 });
  });

  const getMyReports = (token?: string) => {
    const req = request(testApp.app.getHttpServer()).get('/api/v1/reports/my');
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('accepts a valid access token', async () => {
    await getMyReports(testApp.accessTokenFor(user)).expect(200);

    expect(testApp.sessionService.validateAccess).toHaveBeenCalledWith(TEST_SESSION_ID, user._id.toHexString());
    expect(reportsService.getMyReports).toHaveBeenCalledWith(user._id.toHexString(), 1, 20);
  });

  it('returns 401 without a token', async () => {
    await getMyReports().expect(401);
    expect(reportsService.getMyReports).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed token', async () => {
    await getMyReports('not.a.jwt').expect(401);
  });

  it('returns 401 for a token signed with another secret', async () => {
    const forged = testApp.sign(
      { sub: user._id.toHexString(), mobileNumber: user.mobileNumber, role: 'super_admin', tokenVersion: 1, sid: 's', type: 'access' },
      'attacker-secret',
    );

    await getMyReports(forged).expect(401);
  });

  it('returns 401 for an expired token', async () => {
    const expired = testApp.accessTokenFor(user, { exp: Math.floor(Date.now() / 1000) - 60 });

    await getMyReports(expired).expect(401);
  });

  it('returns 401 SESSION_REVOKED when a refresh token is used as an access token', async () => {
    const res = await getMyReports(testApp.accessTokenFor(user, { type: 'refresh' })).expect(401);

    expect(res.body.code).toBe('SESSION_REVOKED');
  });

  it('returns 401 after the session was revoked (logout on another device)', async () => {
    testApp.sessionService.validateAccess.mockRejectedValue(new UnauthorizedException({ code: 'SESSION_REVOKED' }));

    await getMyReports(testApp.accessTokenFor(user)).expect(401);
  });

  it('returns 503 (not 401) when sessions cannot be checked, so clients keep the login', async () => {
    testApp.sessionService.validateAccess.mockRejectedValue(new ServiceUnavailableException());

    await getMyReports(testApp.accessTokenFor(user)).expect(503);
  });

  it('returns 401 when the token version is stale', async () => {
    testApp.userRepo.findById.mockResolvedValue({ ...user, tokenVersion: user.tokenVersion + 1 });

    await getMyReports(testApp.accessTokenFor(user)).expect(401);
  });

  it('returns 401 ACCOUNT_DELETED for deleted accounts', async () => {
    testApp.userRepo.findById.mockResolvedValue({ ...user, isDeleted: true });

    const res = await getMyReports(testApp.accessTokenFor(user)).expect(401);

    expect(res.body.code).toBe('ACCOUNT_DELETED');
  });

  it('returns 423 with the reason for suspended accounts', async () => {
    testApp.userRepo.findById.mockResolvedValue({
      ...user,
      verificationStatus: VerificationStatus.SUSPENDED,
      suspendedReason: 'Spam',
      suspendedUntil: new Date(Date.now() + 86_400_000),
    });

    const res = await getMyReports(testApp.accessTokenFor(user)).expect(423);

    expect(res.body).toEqual(expect.objectContaining({ error: 'ACCOUNT_LOCKED', status: 'suspended', reason: 'Spam' }));
  });

  it('returns 423 for banned accounts', async () => {
    testApp.userRepo.findById.mockResolvedValue({ ...user, verificationStatus: VerificationStatus.BANNED, bannedReason: 'Abuse' });

    const res = await getMyReports(testApp.accessTokenFor(user)).expect(423);

    expect(res.body.status).toBe('banned');
  });
});
