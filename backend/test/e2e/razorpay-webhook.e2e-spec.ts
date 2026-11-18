import { createHmac } from 'crypto';
import * as request from 'supertest';
import { RazorpayWebhookController } from '../../src/modules/payment/controllers/razorpay-webhook.controller';
import { WalletsService } from '../../src/modules/wallets/services/wallets.service';
import { REPOSITORY_TOKENS } from '../../src/shared/database/repositories';
import { createMockRepository } from '../helpers/mock-repository';
import { createTestApp, TestApp } from '../helpers/test-app';

const SECRET = 'e2e-webhook-secret';

describe('Razorpay webhook (e2e)', () => {
  const walletsService = { handleVerificationCallback: jest.fn(), creditReversedWithdrawal: jest.fn() };
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({
      controllers: [RazorpayWebhookController],
      config: { 'payment.razorpay.webhookSecret': SECRET },
      providers: [
        { provide: WalletsService, useValue: walletsService },
        { provide: REPOSITORY_TOKENS.WithdrawalRequest, useValue: createMockRepository() },
        { provide: REPOSITORY_TOKENS.PaymentLog, useValue: createMockRepository() },
        { provide: REPOSITORY_TOKENS.Transaction, useValue: createMockRepository() },
        { provide: REPOSITORY_TOKENS.UserPaymentDetail, useValue: createMockRepository() },
      ],
    });
  });
  afterAll(() => testApp.close());

  const captured = {
    event: 'payment.captured',
    payload: { payment: { entity: { id: 'pay_1', notes: { payment_detail_id: 'pd1' } } } },
  };

  // Posts the exact bytes that were signed, as Razorpay does.
  const post = (rawBody: string, signature: string) =>
    request(testApp.app.getHttpServer())
      .post('/api/v1/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(rawBody);

  it('is public and verifies the HMAC over the raw request body', async () => {
    // Extra whitespace proves the raw bytes are verified, not a re-serialised object.
    const rawBody = JSON.stringify(captured, null, 2);
    const signature = createHmac('sha256', SECRET).update(rawBody).digest('hex');

    await post(rawBody, signature).expect(200, { received: true });

    expect(walletsService.handleVerificationCallback).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'rzp_pl_pd1', success: true }));
  });

  it('returns 401 for a forged signature and does not touch wallets', async () => {
    const rawBody = JSON.stringify(captured);
    const forged = createHmac('sha256', 'attacker').update(rawBody).digest('hex');

    await post(rawBody, forged).expect(401);

    expect(walletsService.handleVerificationCallback).not.toHaveBeenCalled();
  });
});
