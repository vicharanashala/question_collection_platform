import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PaymentLog, User, UserPaymentDetail, Wallet, WithdrawalRequest } from '../../../src/database/entities';
import { PaymentLogStatus, PayoutMethod, WithdrawalStatus } from '../../../src/common/enums';
import { RazorpayPayoutService } from '../../../src/payment/razorpay-payout.service';
import { createTestApp } from '../helpers/app.helper';
import { cleanTestData, seedTestUsers } from '../helpers/seed.helper';
import { getAuthHeaders, getAuthToken } from '../helpers/auth.helper';

describe('PaymentDetail (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
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
    dataSource = app.get(DataSource);
    razorpayPayoutService = testApp.razorpayPayoutService;

    await seedTestUsers(dataSource);

    const farmer = await dataSource.getRepository(User).findOne({
      where: { mobileNumber: '9000000001' },
    });
    farmerId = farmer!.id;

    const wallet = await dataSource.getRepository(Wallet).findOne({
      where: { userId: farmerId },
    });
    farmerWalletId = wallet!.id;

    farmerToken = await getAuthToken(app, '9000000001');
  });

  afterAll(async () => {
    await cleanTestData(dataSource);
    await app.close();
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Seed a WithdrawalRequest in PROCESSING state, crediting the wallet to simulate
   * an in-flight payout (balance was already deducted when the request was created).
   */
  async function seedProcessingWithdrawal(amount: number): Promise<string> {
    const walletRepo = dataSource.getRepository(Wallet);
    const repo = dataSource.getRepository(WithdrawalRequest);

    // Give the wallet a non-zero balance so the reversal credit can be observed
    await walletRepo.update(farmerWalletId, { balance: amount });

    const w = await repo.save(
      repo.create({
        userId: farmerId,
        walletId: farmerWalletId,
        amount,
        payoutMethod: PayoutMethod.UPI,
        payoutDetails: { upiId: 'farmer@upi' },
        status: WithdrawalStatus.PROCESSING,
        razorpayPayoutId: `po_seed_${Date.now()}`,
      } as Partial<WithdrawalRequest>),
    );

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

    const withdrawal = await dataSource
      .getRepository(WithdrawalRequest)
      .findOne({ where: { id: withdrawalId } });
    expect(withdrawal!.status).toBe(WithdrawalStatus.COMPLETED);
    expect(withdrawal!.utrNumber).toBe('UTR123456789');
    expect(withdrawal!.processedAt).not.toBeNull();

    const log = await dataSource
      .getRepository(PaymentLog)
      .findOne({ where: { withdrawalRequestId: withdrawalId } });
    expect(log).not.toBeNull();
    expect(log!.status).toBe(PaymentLogStatus.SUCCESS);
    expect(log!.razorpayPayoutId).toBe(payoutId);
    expect(log!.utrNumber).toBe('UTR123456789');
  });

  it('T9: POST /razorpay/webhook (payout.reversed) → withdrawal REVERSED, wallet balance credited back', async () => {
    const withdrawalId = await seedProcessingWithdrawal(200);
    const payoutId = `po_reversed_${Date.now()}`;

    const walletBefore = await dataSource
      .getRepository(Wallet)
      .findOne({ where: { id: farmerWalletId } });
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

    const withdrawal = await dataSource
      .getRepository(WithdrawalRequest)
      .findOne({ where: { id: withdrawalId } });
    expect(withdrawal!.status).toBe(WithdrawalStatus.REVERSED);
    expect(withdrawal!.failureReason).toMatch(/[Rr]ejected/);

    const walletAfter = await dataSource
      .getRepository(Wallet)
      .findOne({ where: { id: farmerWalletId } });
    // The 200 that was "in flight" should be credited back
    expect(Number(walletAfter!.balance)).toBe(balanceBefore + 200);

    const log = await dataSource
      .getRepository(PaymentLog)
      .findOne({ where: { withdrawalRequestId: withdrawalId } });
    expect(log).not.toBeNull();
    expect(log!.status).toBe(PaymentLogStatus.REVERSED);
  });
});
