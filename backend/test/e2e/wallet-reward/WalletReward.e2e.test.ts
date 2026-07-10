import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, UserPaymentDetail, Wallet } from '../../../src/database/entities';
import { PayoutMethod, WithdrawalStatus } from '../../../src/common/enums';
import { WalletsService } from '../../../src/wallets/wallets.service';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('WalletReward (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let walletsService: WalletsService;
  let farmerToken: string;
  let studentToken: string;
  let farmerId: string;

  // Shared across withdrawal tests (stateful sequence T10 → T18 → T15 → T16 → T17)
  let verifiedDetailId: string;
  let pendingWithdrawalId: string;

  async function seedVerifiedDetail(userId: string): Promise<UserPaymentDetail> {
    const repo = dataSource.getRepository(UserPaymentDetail);
    return repo.save(
      repo.create({
        userId,
        payoutMethod: PayoutMethod.UPI,
        upiId: 'farmer@upi',
        status: 'verified',
        verifiedAt: new Date(),
      }),
    );
  }

  async function seedUnverifiedDetail(userId: string): Promise<UserPaymentDetail> {
    const repo = dataSource.getRepository(UserPaymentDetail);
    return repo.save(
      repo.create({
        userId,
        payoutMethod: PayoutMethod.UPI,
        upiId: 'farmer2@upi',
        status: 'in_progress',
      }),
    );
  }

  async function setWalletBalance(userId: string, balance: number): Promise<void> {
    const walletRepo = dataSource.getRepository(Wallet);
    const wallet = await walletRepo.findOne({ where: { userId } });
    await walletRepo.update(wallet!.id, { balance });
  }

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    dataSource = app.get(DataSource);
    walletsService = app.get(WalletsService);

    await seedTestUsers(dataSource);

    const users = await dataSource.getRepository(User).find({
      where: [{ mobileNumber: '9000000001' }, { mobileNumber: '9000000002' }],
      order: { mobileNumber: 'ASC' },
    });
    farmerId = users[0].id;

    [farmerToken, studentToken] = await Promise.all([
      getAuthToken(app, '9000000001'),
      getAuthToken(app, '9000000002'),
    ]);
  });

  afterAll(async () => {
    await cleanTestData(dataSource);
    await app.close();
  });

  // ── 1. Balance ──────────────────────────────────────────────────────────────

  it('T1: GET /wallets/me — returns balance=0 and currency=INR for new wallet', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallets/me')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body).toMatchObject({ balance: 0, currency: 'INR' });
  });

  // ── 2. Reward tiers ─────────────────────────────────────────────────────────

  it('T2: GET /wallets/me/tier — approvedCount=0 → reward=₹1, tier 1, nextTier exists', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallets/me/tier?approvedCount=0')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.reward).toBe(1);
    expect(res.body.maxApproved).toBe(26);
    expect(res.body.nextTier).not.toBeNull();
  });

  it('T3: GET /wallets/me/tier — approvedCount=25 → still reward=₹1 (last in tier 1)', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallets/me/tier?approvedCount=25')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.reward).toBe(1);
  });

  it('T4: GET /wallets/me/tier — approvedCount=26 → reward=₹5, tier 2', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallets/me/tier?approvedCount=26')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.reward).toBe(5);
    expect(res.body.maxApproved).toBe(251);
  });

  it('T5: GET /wallets/me/tier — approvedCount=251 → reward=₹10, nextTier=null', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallets/me/tier?approvedCount=251')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.reward).toBe(10);
    expect(res.body.nextTier).toBeNull();
  });

  // ── 3. Credit reward (via service) ──────────────────────────────────────────

  it('T6: creditReward — tier 1 (approvedCount=1) → balance +₹1', async () => {
    await walletsService.creditReward({
      userId: farmerId,
      questionId: 'aaaaaaaa-0000-0000-0000-000000000001',
      approvedCount: 1,
    });

    const res = await request(app.getHttpServer())
      .get('/wallets/me')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.balance).toBe(1);
  });

  it('T7: creditReward — tier 2 (approvedCount=26) → balance +₹5 (cumulative=₹6)', async () => {
    await walletsService.creditReward({
      userId: farmerId,
      questionId: 'aaaaaaaa-0000-0000-0000-000000000002',
      approvedCount: 26,
    });

    const res = await request(app.getHttpServer())
      .get('/wallets/me')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.balance).toBe(6);
  });

  // ── 4. Wallet config ────────────────────────────────────────────────────────

  it('T8: GET /wallets/me/config — returns minWithdrawalAmount from admin config', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallets/me/config')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.minWithdrawalAmount).toBe(50);
  });

  // ── 5. Transactions ─────────────────────────────────────────────────────────

  it('T9: GET /wallets/me/transactions — lists the reward credits from T6 and T7', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallets/me/transactions')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.transactions)).toBe(true);
    const types: string[] = res.body.transactions.map((t: any) => t.type);
    expect(types).toContain('credit');
  });

  // ── 6. Withdraw ─────────────────────────────────────────────────────────────

  it('T10: POST /wallets/withdraw — happy path → 201 PENDING, balance deducted', async () => {
    // Start from a known balance so assertions are deterministic
    await setWalletBalance(farmerId, 200);
    const detail = await seedVerifiedDetail(farmerId);
    verifiedDetailId = detail.id;

    const res = await request(app.getHttpServer())
      .post('/wallets/withdraw')
      .set(getAuthHeaders(farmerToken))
      .send({ amount: 100, paymentDetailId: verifiedDetailId })
      .expect(201);

    pendingWithdrawalId = res.body.id;
    expect(res.body.status).toBe(WithdrawalStatus.PENDING);
    expect(Number(res.body.amount)).toBe(100);

    const balRes = await request(app.getHttpServer())
      .get('/wallets/me')
      .set(getAuthHeaders(farmerToken))
      .expect(200);
    expect(balRes.body.balance).toBe(100);
  });

  it('T11: POST /wallets/withdraw — amount below minimum (₹10 < ₹50) → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallets/withdraw')
      .set(getAuthHeaders(farmerToken))
      .send({ amount: 10, paymentDetailId: verifiedDetailId })
      .expect(400);

    expect(res.body.message).toMatch(/at least ₹50/);
  });

  it('T12: POST /wallets/withdraw — amount exceeds balance (₹500 > ₹100) → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallets/withdraw')
      .set(getAuthHeaders(farmerToken))
      .send({ amount: 500, paymentDetailId: verifiedDetailId })
      .expect(400);

    expect(res.body.message).toMatch(/[Ii]nsufficient/);
  });

  it('T13: POST /wallets/withdraw — unverified payment detail → 400', async () => {
    const unverified = await seedUnverifiedDetail(farmerId);

    const res = await request(app.getHttpServer())
      .post('/wallets/withdraw')
      .set(getAuthHeaders(farmerToken))
      .send({ amount: 60, paymentDetailId: unverified.id })
      .expect(400);

    expect(res.body.message).toMatch(/not verified/i);
  });

  it('T14: POST /wallets/withdraw — duplicate pending request → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallets/withdraw')
      .set(getAuthHeaders(farmerToken))
      .send({ amount: 60, paymentDetailId: verifiedDetailId })
      .expect(400);

    expect(res.body.message).toMatch(/already pending/i);
  });

  // ── 7. Withdrawals list ──────────────────────────────────────────────────────

  it('T18: GET /wallets/me/withdrawals — pending withdrawal from T10 appears in list', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallets/me/withdrawals')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.total).toBeGreaterThanOrEqual(1);
    const ids: string[] = res.body.items.map((w: any) => w.id);
    expect(ids).toContain(pendingWithdrawalId);
  });

  // ── 8. Cancel withdrawal ────────────────────────────────────────────────────

  it('T15: DELETE /wallets/withdrawals/:id — cancel PENDING → 200 CANCELLED, balance refunded', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/wallets/withdrawals/${pendingWithdrawalId}`)
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(res.body.status).toBe(WithdrawalStatus.CANCELLED);

    const balRes = await request(app.getHttpServer())
      .get('/wallets/me')
      .set(getAuthHeaders(farmerToken))
      .expect(200);
    expect(balRes.body.balance).toBe(200);
  });

  it('T16: DELETE /wallets/withdrawals/:id — cancel already-cancelled → 400', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/wallets/withdrawals/${pendingWithdrawalId}`)
      .set(getAuthHeaders(farmerToken))
      .expect(400);

    expect(res.body.message).toMatch(/[Pp]ending/);
  });

  it('T17: DELETE /wallets/withdrawals/:id — non-owner cancel → 404', async () => {
    await request(app.getHttpServer())
      .delete(`/wallets/withdrawals/${pendingWithdrawalId}`)
      .set(getAuthHeaders(studentToken))
      .expect(404);
  });
});
