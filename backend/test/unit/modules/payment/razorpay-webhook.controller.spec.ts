import { createHmac } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { RazorpayWebhookController } from '../../../../src/modules/payment/controllers/razorpay-webhook.controller';
import { WalletsService } from '../../../../src/modules/wallets/services/wallets.service';
import { PaymentLogStatus, TransactionStatus, WithdrawalStatus } from '../../../../src/shared/classes/enums';
import { REPOSITORY_TOKENS } from '../../../../src/shared/database/repositories';
import { createMockRepository } from '../../../helpers/mock-repository';

const SECRET = 'webhook-secret';

// Signs a payload the way Razorpay does: hex HMAC-SHA256 of the raw body.
const sign = (rawBody: string, secret = SECRET) => createHmac('sha256', secret).update(rawBody).digest('hex');

describe('RazorpayWebhookController', () => {
  const walletsService = { handleVerificationCallback: jest.fn(), creditReversedWithdrawal: jest.fn() };
  const withdrawalRepo = createMockRepository();
  const paymentLogRepo = createMockRepository();
  const transactionRepo = createMockRepository();
  let webhookSecret: string | undefined;
  let controller: RazorpayWebhookController;

  beforeEach(async () => {
    webhookSecret = SECRET;
    const moduleRef = await Test.createTestingModule({
      controllers: [RazorpayWebhookController],
      providers: [
        { provide: WalletsService, useValue: walletsService },
        { provide: ConfigService, useValue: { get: () => webhookSecret } },
        { provide: REPOSITORY_TOKENS.WithdrawalRequest, useValue: withdrawalRepo },
        { provide: REPOSITORY_TOKENS.PaymentLog, useValue: paymentLogRepo },
        { provide: REPOSITORY_TOKENS.Transaction, useValue: transactionRepo },
        { provide: REPOSITORY_TOKENS.UserPaymentDetail, useValue: createMockRepository() },
      ],
    }).compile();
    controller = moduleRef.get(RazorpayWebhookController);

    paymentLogRepo.create.mockImplementation(async (log: unknown) => log);
    paymentLogRepo.findOne.mockResolvedValue(null);
    transactionRepo.updateMany.mockResolvedValue({ affected: 1 });
  });

  // Delivers a webhook, signed correctly unless a signature is given.
  const deliver = (body: Record<string, unknown>, signature?: string) => {
    const rawBody = JSON.stringify(body);
    const req = {
      rawBody: Buffer.from(rawBody),
      headers: { 'x-razorpay-signature': signature ?? sign(rawBody) },
    } as unknown as Request;
    return controller.handleWebhook(body, req);
  };

  const payoutEvent = (event: string, entity: Record<string, unknown>) => ({ event, payload: { payout: { entity } } });

  describe('signature verification', () => {
    it('accepts a correctly signed webhook', async () => {
      await expect(deliver({ event: 'unknown.event' })).resolves.toEqual({ received: true });
    });

    it('rejects a webhook signed with another secret', async () => {
      const body = { event: 'payout.processed' };

      await expect(deliver(body, sign(JSON.stringify(body), 'attacker-secret'))).rejects.toBeInstanceOf(UnauthorizedException);
      expect(withdrawalRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects a signature that is not hex', async () => {
      await expect(deliver({ event: 'payout.processed' }, 'not-a-signature')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a body modified after signing', async () => {
      const signature = sign(JSON.stringify({ event: 'payout.processed', amount: 1 }));

      await expect(deliver({ event: 'payout.processed', amount: 100000 }, signature)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    // Known gap: the controller only verifies when the header is present, so an unsigned
    // request is processed even with a secret configured. This flips to passing once fixed.
    it.failing('rejects an unsigned webhook when a secret is configured', async () => {
      const req = { rawBody: Buffer.from('{}'), headers: {} } as unknown as Request;

      await expect(controller.handleWebhook({ event: 'unknown.event' }, req)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('verification payments', () => {
    it('marks the payment detail verified on payment.captured', async () => {
      await deliver({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', notes: { payment_detail_id: 'pd1' } } } } });

      expect(walletsService.handleVerificationCallback).toHaveBeenCalledWith({
        orderId: 'rzp_pl_pd1',
        success: true,
        pinelabsTransactionId: 'pay_1',
      });
    });

    it('marks the payment detail failed on payment.failed', async () => {
      await deliver({
        event: 'payment.failed',
        payload: { payment: { entity: { id: 'pay_2', status: 'failed', notes: { payment_detail_id: 'pd2' } } } },
      });

      expect(walletsService.handleVerificationCallback).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'rzp_pl_pd2', success: false, errorCode: 'PAYMENT_FAILED' }),
      );
    });

    it('ignores captured payments without a payment detail id', async () => {
      await deliver({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_3', notes: {} } } } });

      expect(walletsService.handleVerificationCallback).not.toHaveBeenCalled();
    });

    it('stores the bank registered name when fund account validation succeeds', async () => {
      await deliver({
        event: 'fund_account.validation.completed',
        payload: {
          'fund_account.validation': {
            entity: { id: 'fav_1', status: 'completed', notes: { payment_detail_id: 'pd4' }, results: { registered_name: 'RAMESH KUMAR' } },
          },
        },
      });

      expect(walletsService.handleVerificationCallback).toHaveBeenCalledWith({
        orderId: 'rzp_pl_pd4',
        success: true,
        registeredName: 'RAMESH KUMAR',
      });
    });

    it('passes the bank reason when fund account validation fails', async () => {
      await deliver({
        event: 'fund_account.validation.failed',
        payload: {
          'fund_account.validation': { entity: { id: 'fav_2', notes: { payment_detail_id: 'pd5' }, status_details: { reason: 'invalid_ifsc' } } },
        },
      });

      expect(walletsService.handleVerificationCallback).toHaveBeenCalledWith({
        orderId: 'rzp_pl_pd5',
        success: false,
        errorCode: 'VALIDATION_FAILED',
        errorMessage: 'invalid_ifsc',
      });
    });
  });

  describe('payout.processed', () => {
    it('completes the withdrawal, its pending transaction and logs the UTR', async () => {
      withdrawalRepo.findOne.mockResolvedValue({ id: 'w1', status: WithdrawalStatus.PROCESSING });

      await deliver(payoutEvent('payout.processed', { id: 'pout_1', status: 'processed', reference_id: 'wd_w1', utr: 'UTR123' }));

      expect(withdrawalRepo.findOne).toHaveBeenCalledWith({ where: { id: 'w1' } });
      expect(withdrawalRepo.update).toHaveBeenCalledWith('w1', expect.objectContaining({ status: WithdrawalStatus.COMPLETED, utrNumber: 'UTR123' }));
      expect(transactionRepo.updateMany).toHaveBeenCalledWith(
        { referenceId: 'w1', status: TransactionStatus.PENDING },
        { status: TransactionStatus.COMPLETED },
      );
      expect(paymentLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ withdrawalRequestId: 'w1', razorpayPayoutId: 'pout_1', status: PaymentLogStatus.SUCCESS }),
      );
    });

    it('back-fills an existing payment log instead of duplicating it', async () => {
      withdrawalRepo.findOne.mockResolvedValue({ id: 'w1', status: WithdrawalStatus.PROCESSING });
      paymentLogRepo.findOne.mockResolvedValue({ _id: 'log-1' });

      await deliver(payoutEvent('payout.processed', { id: 'pout_1', status: 'processed', reference_id: 'wd_w1', utr: 'UTR123' }));

      expect(paymentLogRepo.create).not.toHaveBeenCalled();
      expect(paymentLogRepo.update).toHaveBeenCalledWith('log-1', { utrNumber: 'UTR123', status: PaymentLogStatus.SUCCESS });
    });

    it('ignores payouts for unknown withdrawals', async () => {
      withdrawalRepo.findOne.mockResolvedValue(null);

      await deliver(payoutEvent('payout.processed', { id: 'pout_1', status: 'processed', reference_id: 'wd_missing' }));

      expect(withdrawalRepo.update).not.toHaveBeenCalled();
      expect(transactionRepo.updateMany).not.toHaveBeenCalled();
    });

    it('ignores payouts without a reference id', async () => {
      await deliver(payoutEvent('payout.processed', { id: 'pout_1', status: 'processed' }));

      expect(withdrawalRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('payout.rejected', () => {
    it('fails the withdrawal and logs it', async () => {
      withdrawalRepo.findOne.mockResolvedValue({ id: 'w2', status: WithdrawalStatus.PROCESSING });

      await deliver(payoutEvent('payout.rejected', { id: 'pout_2', reference_id: 'wd_w2', remarks: 'Beneficiary bank down' }));

      expect(withdrawalRepo.update).toHaveBeenCalledWith('w2', expect.objectContaining({ status: WithdrawalStatus.FAILED }));
      expect(paymentLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentLogStatus.FAILED }));
      expect(transactionRepo.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('payout.reversed', () => {
    const reversal = payoutEvent('payout.reversed', { id: 'pout_3', status: 'reversed', reference_id: 'wd_w3', remarks: 'Account closed' });

    it('credits the amount back to the wallet and marks the withdrawal reversed', async () => {
      withdrawalRepo.findOne.mockResolvedValue({ id: 'w3', walletId: 'wallet-1', amount: 250, status: WithdrawalStatus.COMPLETED });

      await deliver(reversal);

      expect(walletsService.creditReversedWithdrawal).toHaveBeenCalledWith('wallet-1', 250, 'w3', 'pout_3');
      expect(withdrawalRepo.update).toHaveBeenCalledWith(
        'w3',
        expect.objectContaining({ status: WithdrawalStatus.REVERSED, failureReason: 'Account closed' }),
      );
      expect(paymentLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentLogStatus.REVERSED, errorCode: 'PAYOUT_REVERSED' }),
      );
    });

    it.each([WithdrawalStatus.REVERSED, WithdrawalStatus.FAILED])(
      'never credits twice when the withdrawal is already %s (replayed webhook)',
      async (status) => {
        withdrawalRepo.findOne.mockResolvedValue({ id: 'w3', walletId: 'wallet-1', amount: 250, status });

        await deliver(reversal);

        expect(walletsService.creditReversedWithdrawal).not.toHaveBeenCalled();
        expect(withdrawalRepo.update).not.toHaveBeenCalled();
      },
    );
  });

  it('acknowledges events it does not handle', async () => {
    await expect(deliver({ event: 'refund.created' })).resolves.toEqual({ received: true });
    expect(walletsService.handleVerificationCallback).not.toHaveBeenCalled();
  });

  it('skips verification in development when no secret is configured', async () => {
    webhookSecret = undefined;

    await expect(deliver({ event: 'unknown.event' }, 'anything')).resolves.toEqual({ received: true });
  });
});
