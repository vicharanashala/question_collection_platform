import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { VerificationStatus } from '../../../src/shared/classes/enums';
import { REPOSITORY_TOKENS, IUserRepository, IWalletRepository } from '../../../src/shared/database/repositories';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let configService: ConfigService;
  let userRepo: IUserRepository;
  let walletRepo: IWalletRepository;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    configService = app.get(ConfigService);
    userRepo = app.get<IUserRepository>(REPOSITORY_TOKENS.User);
    walletRepo = app.get<IWalletRepository>(REPOSITORY_TOKENS.Wallet);

    await seedTestUsers(app);
  });

  afterAll(async () => {
    await cleanTestData(app);
    await app.close();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Overwrite the OTP hash directly, same trick auth.helper.ts uses for other suites. */
  async function setOtp(mobileNumber: string, otp: string, expiresAt: Date) {
    await userRepo.updateMany(
      { mobileNumber },
      { otpHash: await bcrypt.hash(otp, 12), otpExpiresAt: expiresAt },
    );
  }

  /**
   * Real bug workaround — NOT a fix, see Auth.e2e.md "Last run" / test_plan.md 2026-08-12.
   * AuthService.requestOtp() creates a stub User (no username) for any never-before-seen
   * mobile number. The Mongoose schema has `username` as `unique: true, sparse: true,
   * default: null` — but `default: null` makes Mongoose write an *explicit* null, and a
   * sparse index only skips documents where the field is entirely absent, not explicitly
   * null. So the first-ever pre-registration OTP request in a fresh DB succeeds; the second
   * one, for any *different* new number, 500s on a duplicate-key error (both docs have
   * `username: null`). This is a real product bug, not fixed here (out of scope for QA).
   * Immediately clearing the null to a unique placeholder after each fresh stub is created
   * lets the rest of this suite keep exercising real request-otp/verify-otp/register
   * behavior instead of tripping this bug on every subsequent "brand-new number" test.
   */
  async function clearNullUsername(mobileNumber: string) {
    await userRepo.updateMany({ mobileNumber }, { username: `pending_${mobileNumber}` } as never);
  }

  // ── 1. Request OTP ────────────────────────────────────────────────────────────

  it('T1: POST /auth/request-otp — valid mobile → 200, otpHash + otpExpiresAt persisted', async () => {
    const mobileNumber = '9111111101';

    await request(app.getHttpServer())
      .post('/auth/request-otp')
      .send({ mobileNumber })
      .expect(200);

    const user = await userRepo.findOne({ mobileNumber });
    expect(user).not.toBeNull();
    expect(user!.otpHash).not.toBeNull();
    expect(user!.otpExpiresAt).not.toBeNull();

    await clearNullUsername(mobileNumber);
  });

  it('T2: POST /auth/request-otp — 11th request within 15min window → 400 (rate limited)', async () => {
    // .env.test sets OTP_RATE_LIMIT=false globally so other suites aren't throttled.
    // Spy ConfigService.get to enable only the 'app.otpRateLimit' lookup for this test —
    // avoids depending on vitest's fork-pool process.env isolation semantics.
    const original = configService.get.bind(configService);
    const spy = vi.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'app.otpRateLimit') return true as never;
      return original(key);
    });

    try {
      const mobileNumber = '9111111102';

      // AuthService.otpMaxRequestsPerWindow is 10/15min (raised from 3 on `develop` —
      // "increase OTP request limit to 10 per 15 minutes").
      for (let i = 0; i < 10; i++) {
        await request(app.getHttpServer())
          .post('/auth/request-otp')
          .send({ mobileNumber })
          .expect(200);
        if (i === 0) await clearNullUsername(mobileNumber);
      }

      const res = await request(app.getHttpServer())
        .post('/auth/request-otp')
        .send({ mobileNumber })
        .expect(400);

      expect(res.body.message).toMatch(/too many otp requests/i);
    } finally {
      spy.mockRestore();
    }
  });

  // ── 2. Verify OTP ──────────────────────────────────────────────────────────────

  it('T3: POST /auth/verify-otp — wrong code → 401', async () => {
    const mobileNumber = '9000000001'; // seeded farmer
    await request(app.getHttpServer()).post('/auth/request-otp').send({ mobileNumber }).expect(200);
    await setOtp(mobileNumber, '123456', new Date(Date.now() + 5 * 60 * 1000));

    const res = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ mobileNumber, otp: '654321' })
      .expect(401);

    expect(res.body.message).toMatch(/invalid otp/i);
  });

  it('T4: POST /auth/verify-otp — expired OTP → 401', async () => {
    const mobileNumber = '9000000001';
    await request(app.getHttpServer()).post('/auth/request-otp').send({ mobileNumber }).expect(200);
    await setOtp(mobileNumber, '123456', new Date(Date.now() - 60 * 1000)); // already expired

    const res = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ mobileNumber, otp: '123456' })
      .expect(401);

    expect(res.body.message).toMatch(/expired/i);
  });

  it('T5: POST /auth/verify-otp — brand-new mobile number → requiresRegistration + tempToken, no full tokens', async () => {
    const mobileNumber = '9111111105';
    await request(app.getHttpServer()).post('/auth/request-otp').send({ mobileNumber }).expect(200);
    await clearNullUsername(mobileNumber);
    await setOtp(mobileNumber, '123456', new Date(Date.now() + 5 * 60 * 1000));

    const res = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ mobileNumber, otp: '123456' })
      .expect(200);

    expect(res.body.requiresRegistration).toBe(true);
    expect(res.body.tempToken).toBeDefined();
    expect(res.body.tokens).toBeUndefined();

    const user = await userRepo.findOne({ mobileNumber });
    expect(user!.name).toBe('');
  });

  // ── 3. Register ────────────────────────────────────────────────────────────────

  it('T6: POST /auth/register — completes registration for an OTP-verified mobile → 201, wallet created', async () => {
    const mobileNumber = '9111111106';
    await request(app.getHttpServer()).post('/auth/request-otp').send({ mobileNumber }).expect(200);
    await setOtp(mobileNumber, '123456', new Date(Date.now() + 5 * 60 * 1000));
    await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ mobileNumber, otp: '123456' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'New Farmer',
        username: 'new_farmer_106',
        mobileNumber,
        state: 'Maharashtra',
        district: 'Pune',
        block: 'Haveli',
        village: 'Wagholi',
        category: 'farmer',
        languagePreference: 'mr',
        consentGiven: true,
      })
      .expect(201);

    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.user.name).toBe('New Farmer');

    const user = await userRepo.findOne({ mobileNumber });
    expect(user!.verificationStatus).toBe(VerificationStatus.PENDING);

    const wallet = await walletRepo.findOne({ userId: user!.id });
    expect(wallet).not.toBeNull();
  });

  it('T7: POST /auth/register — mobile with no prior OTP verification → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Ghost User',
        username: 'ghost_user_107',
        mobileNumber: '9111111107',
        state: 'Maharashtra',
        district: 'Pune',
        category: 'student',
        languagePreference: 'en',
        consentGiven: true,
      })
      .expect(401);

    expect(res.body.message).toMatch(/no otp-verified account/i);
  });

  // ── 4. Refresh tokens ──────────────────────────────────────────────────────────

  it('T8: POST /auth/refresh — valid refresh token → 200, new token pair', async () => {
    const mobileNumber = '9000000002'; // seeded student
    await request(app.getHttpServer()).post('/auth/request-otp').send({ mobileNumber }).expect(200);
    await setOtp(mobileNumber, '123456', new Date(Date.now() + 5 * 60 * 1000));
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ mobileNumber, otp: '123456' })
      .expect(200);

    const refreshToken = verifyRes.body.tokens.refreshToken;

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('T9: POST /auth/refresh — garbage refresh token → 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-real-jwt' })
      .expect(401);

    expect(res.body.message).toMatch(/invalid or expired refresh token/i);
  });

  it('T10: POST /auth/refresh — refresh token issued before logout is rejected after logout (tokenVersion enforcement)', async () => {
    const mobileNumber = '9000000003'; // seeded curator
    await request(app.getHttpServer()).post('/auth/request-otp').send({ mobileNumber }).expect(200);
    await setOtp(mobileNumber, '123456', new Date(Date.now() + 5 * 60 * 1000));
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/verify-otp')
      .send({ mobileNumber, otp: '123456' })
      .expect(200);

    const { accessToken, refreshToken } = verifyRes.body.tokens;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set(getAuthHeaders(accessToken))
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    expect(res.body.message).toMatch(/session expired/i);
  });

  // ── 5. Profile & logout ─────────────────────────────────────────────────────────

  it('T11: GET /auth/me — valid token → correct profile shape', async () => {
    const mobileNumber = '9000000004'; // seeded finance
    const token = await getAuthToken(app, mobileNumber);

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set(getAuthHeaders(token))
      .expect(200);

    expect(res.body.user.mobileNumber).toBe(mobileNumber);
    expect(res.body.user.role).toBe('finance');
  });

  it('T12: POST /auth/logout — old access token rejected on subsequent request', async () => {
    const mobileNumber = '9000000005'; // seeded admin
    const token = await getAuthToken(app, mobileNumber);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set(getAuthHeaders(token))
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set(getAuthHeaders(token))
      .expect(401);

    expect(res.body.message).toMatch(/session expired/i);
  });

  it('T13: Suspended user with a still-unexpired access token → 423 on next authenticated request', async () => {
    const mobileNumber = '9000000006'; // seeded super_admin
    const token = await getAuthToken(app, mobileNumber);

    await userRepo.updateMany(
      { mobileNumber },
      {
        verificationStatus: VerificationStatus.SUSPENDED,
        suspendedReason: 'Fraud review',
        suspendedAt: new Date(),
        suspendedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    );

    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set(getAuthHeaders(token))
      .expect(423);

    expect(res.body.error).toBe('ACCOUNT_LOCKED');
    expect(res.body.status).toBe(VerificationStatus.SUSPENDED);

    // Restore so this seeded user doesn't affect any test file that runs after this one.
    await userRepo.updateMany(
      { mobileNumber },
      {
        verificationStatus: VerificationStatus.VERIFIED,
        suspendedReason: null,
        suspendedAt: null,
        suspendedUntil: null,
      },
    );
  });
});
