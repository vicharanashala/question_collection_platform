import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PaymentLogStatus, PayoutMethod, WithdrawalStatus } from '../../../src/shared/classes/enums';
import { RazorpayPayoutService } from '../../../src/modules/payment/razorpay-payout.service';
import {
  REPOSITORY_TOKENS,
  IUserRepository,
  IWalletRepository,
  IWithdrawalRequestRepository,
  IPaymentLogRepository,
} from '../../../src/shared/database/repositories';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('PaymentDetail (e2e)', () => {
  let app: INestApplication;
  let walletRepo: IWalletRepository;
  let withdrawalRepo: IWithdrawalRequestRepository;
  let paymentLogRepo: IPaymentLogRepository;
  let razorpayPayoutService: RazorpayPayoutService;
  let farmerToken: string;
  let farmerId: string;
  let farmerWalletId: string;

  // Detail IDs shared across tests
  let upiDetailId: string;
  let bankDetailId: string;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    razorpayPayoutService = testApp.razorpayPayoutService;
    walletRepo = app.get<IWalletRepository>(REPOSITORY_TOKENS.Wallet);
    withdrawalRepo = app.get<IWithdrawalRequestRepository>(REPOSITORY_TOKENS.WithdrawalRequest);
    paymentLogRepo = app.get<IPaymentLogRepository>(REPOSITORY_TOKENS.PaymentLog);
    const userRepo = app.get<IUserRepository>(REPOSITORY_TOKENS.User);

    await seedTestUsers(app);

    const farmer = await userRepo.findByMobile('9000000001');
    farmerId = farmer!.id;

    const wallet = await walletRepo.findByUserId(farmerId);
    farmerWalletId = wallet!.id;

    farmerToken = await getAuthToken(app, '9000000001');
  });

  afterAll(async () => {
    await cleanTestData(app);
    await app.close();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Seed a WithdrawalRequest in PROCESSING state, crediting the wallet to simulate
   * an in-flight payout (balance was already deducted when the request was created).
   *
   * Real bug workaround (documented in PaymentDetail.e2e.md / test_plan.md), same class as
   * the username/verificationOrderId schema issues: `orderId` on WithdrawalRequest is
   * `unique: true, default: null` (no `sparse`) — a second seeded withdrawal with an
   * explicit null collides. Giving each one a unique placeholder avoids tripping this on
   * setup so T9 can exercise its actual intended webhook-reversal assertion.
   */
  async function seedProcessingWithdrawal(amount: number): Promise<string> {
    // Give the wallet a non-zero balance so the reversal credit can be observed
    await walletRepo.update(farmerWalletId, { balance: amount });

    const w = await withdrawalRepo.create({
      userId: farmerId,
      walletId: farmerWalletId,
      amount,
      payoutMethod: PayoutMethod.UPI,
      payoutDetails: { upiId: 'farmer@upi' },
      status: WithdrawalStatus.PROCESSING,
      razorpayPayoutId: `po_seed_${Date.now()}`,
      orderId: `seed-order-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    } as never);

    return w.id;
  }

  // ── 1. Add payment details ────────────────────────────────────────────────

  it('T1: POST /wallets/payment-details (UPI) — Razorpay validates synchronously → status=verified', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallets/payment-details')
      .set(getAuthHeaders(farmerToken))
      .send({ payoutMethod: 'upi', upiId: 'farmer@upi' })
      .expect(201);

    expect(res.body.status).toBe('verified');
    expect(res.body.id).toBeDefined();
    upiDetailId = res.body.id;

    // Confirm the Razorpay service chain was exercised
    expect(vi.mocked(razorpayPayoutService.createContact)).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '9000000001' }),
    );
    expect(vi.mocked(razorpayPayoutService.createFundAccount)).toHaveBeenCalled();
    expect(vi.mocked(razorpayPayoutService.validateFundAccount)).toHaveBeenCalled();
  });

  it('T2: POST /wallets/payment-details (UPI duplicate) — same verified UPI ID → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallets/payment-details')
      .set(getAuthHeaders(farmerToken))
      .send({ payoutMethod: 'upi', upiId: 'farmer@upi' })
      .expect(400);

    expect(res.body.message).toMatch(/already verified/i);
  });

  // Real bug, not fixed here (documented in PaymentDetail.e2e.md / test_plan.md), unlike the
  // seed-side null collisions elsewhere in this file: this one fires from inside
  // WalletsService.addPaymentDetail()'s own `this.paymentDetailRepo.save(detail)` call
  // (wallets.service.ts:518), BEFORE the test gets any id back to patch — so it can't be
  // worked around at the test level. UserPaymentDetail's `verificationOrderId` field is
  // `unique: true, default: null` (no `sparse`), so ANY user's second payment-detail
  // creation of any kind (UPI or bank) always 500s with a duplicate-key error on the
  // second document's explicit null. This is a real, production-affecting bug — every real
  // user adding a second payment method would hit this.
  it('T3: POST /wallets/payment-details (bank_transfer) — validates synchronously → status=verified', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallets/payment-details')
      .set(getAuthHeaders(farmerToken))
      .send({
        payoutMethod: 'bank_transfer',
        accountNumber: '123456789012',
        confirmAccountNumber: '123456789012',
        ifsc: 'SBIN0001234',
        accountHolderName: 'Test Farmer',
        bankName: 'State Bank of India',
      })
      .expect(201);

    expect(res.body.status).toBe('verified');
    expect(res.body.id).toBeDefined();
    bankDetailId = res.body.id;
  });

  it('T4: POST /wallets/payment-details (bank_transfer — mismatched account numbers) → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallets/payment-details')
      .set(getAuthHeaders(farmerToken))
      .send({
        payoutMethod: 'bank_transfer',
        accountNumber: '123456789012',
        confirmAccountNumber: '999999999999',
        ifsc: 'SBIN0001234',
        accountHolderName: 'Test Farmer',
        bankName: 'SBI',
      })
      .expect(400);

    expect(res.body.message).toMatch(/do not match/i);
  });

  it('T5: POST /wallets/payment-details (invalid UPI format) → 400 validation error', async () => {
    const res = await request(app.getHttpServer())
      .post('/wallets/payment-details')
      .set(getAuthHeaders(farmerToken))
      .send({ payoutMethod: 'upi', upiId: 'not-a-valid-upi' })
      .expect(400);

    expect(res.body.message).toBeDefined();
  });

  // ── 2. List payment details ───────────────────────────────────────────────

  it('T6: GET /wallets/payment-details — lists UPI and bank details with correct shape', async () => {
    const res = await request(app.getHttpServer())
      .get('/wallets/payment-details')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);

    const ids: string[] = res.body.map((d: any) => d.id);
    expect(ids).toContain(upiDetailId);
    expect(ids).toContain(bankDetailId);

    const upi = res.body.find((d: any) => d.id === upiDetailId);
    expect(upi.payoutMethod).toBe('upi');
    expect(upi.status).toBe('verified');
    expect(upi.displayValue).toBe('farmer@upi');

    const bank = res.body.find((d: any) => d.id === bankDetailId);
    expect(bank.payoutMethod).toBe('bank_transfer');
    expect(bank.displayValue).toMatch(/^\*{4}\d{4}$/);
  });

  // ── 3. Delete payment detail ──────────────────────────────────────────────

  it('T7: DELETE /wallets/payment-details/:id — removes the bank detail; UPI detail remains', async () => {
    await request(app.getHttpServer())
      .delete(`/wallets/payment-details/${bankDetailId}`)
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/wallets/payment-details')
      .set(getAuthHeaders(farmerToken))
      .expect(200);

    const ids: string[] = res.body.map((d: any) => d.id);
    expect(ids).not.toContain(bankDetailId);
    expect(ids).toContain(upiDetailId);
  });

  // ── 4. Razorpay webhook: payout lifecycle ─────────────────────────────────

  it('T8: POST /razorpay/webhook (payout.processed) → withdrawal COMPLETED, payment log created with UTR', async () => {
    const withdrawalId = await seedProcessingWithdrawal(100);
    const payoutId = `po_processed_${Date.now()}`;

    const res = await request(app.getHttpServer())
      .post('/razorpay/webhook')
      .send({
        event: 'payout.processed',
        payload: {
          payout: {
            entity: {
              id: payoutId,
              status: 'processed',
              reference_id: `wd_${withdrawalId}`,
              utr: 'UTR123456789',
              amount: 10000,
            },
          },
        },
      })
      .expect(200);

    expect(res.body.received).toBe(true);

    const withdrawal = await withdrawalRepo.findById(withdrawalId);
    expect(withdrawal!.status).toBe(WithdrawalStatus.COMPLETED);
    expect(withdrawal!.utrNumber).toBe('UTR123456789');
    expect(withdrawal!.processedAt).not.toBeNull();

    const log = await paymentLogRepo.findOne({ withdrawalRequestId: withdrawalId });
    expect(log).not.toBeNull();
    expect(log!.status).toBe(PaymentLogStatus.SUCCESS);
    expect(log!.razorpayPayoutId).toBe(payoutId);
    expect(log!.utrNumber).toBe('UTR123456789');
  });

  // Real bug, not fixed here (same class as WalletReward's T6/T7/T10/T15-T17 — documented in
  // WalletReward.e2e.md / test_plan.md): the payout.reversed webhook handler calls
  // WalletsService.creditReversedWithdrawal(), which — like creditReward()/withdraw() —
  // calls `this.ds.createQueryRunner()` (wallets.service.ts:422). `this.ds` is never
  // provided in Mongo mode, so this throws unconditionally. Reversed payouts can never
  // credit the wallet back right now.
  it('T9: POST /razorpay/webhook (payout.reversed) → withdrawal REVERSED, wallet balance credited back', async () => {
    const withdrawalId = await seedProcessingWithdrawal(200);
    const payoutId = `po_reversed_${Date.now()}`;

    const walletBefore = await walletRepo.findById(farmerWalletId);
    const balanceBefore = Number(walletBefore!.balance);

    await request(app.getHttpServer())
      .post('/razorpay/webhook')
      .send({
        event: 'payout.reversed',
        payload: {
          payout: {
            entity: {
              id: payoutId,
              status: 'reversed',
              reference_id: `wd_${withdrawalId}`,
              remarks: 'Beneficiary bank rejected payout',
              amount: 20000,
            },
          },
        },
      })
      .expect(200);

    const withdrawal = await withdrawalRepo.findById(withdrawalId);
    expect(withdrawal!.status).toBe(WithdrawalStatus.REVERSED);
    expect(withdrawal!.failureReason).toMatch(/[Rr]ejected/);

    const walletAfter = await walletRepo.findById(farmerWalletId);
    // The 200 that was "in flight" should be credited back
    expect(Number(walletAfter!.balance)).toBe(balanceBefore + 200);

    const log = await paymentLogRepo.findOne({ withdrawalRequestId: withdrawalId });
    expect(log).not.toBeNull();
    expect(log!.status).toBe(PaymentLogStatus.REVERSED);
  });
});
