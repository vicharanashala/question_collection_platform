import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  WithdrawalRequest,
  PaymentLog,
  UserPaymentDetail,
} from '../database/entities';
import { WithdrawalStatus, PaymentLogStatus } from '../common/enums';
import { WalletsService } from '../wallets/wallets.service';

interface RazorpayPaymentEntity {
  id?: string;
  status?: string;
  amount?: number;
  notes?: Record<string, string>;
}

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
    payout?: {
      entity?: {
        id?: string;
        status?: string;
        reference_id?: string;
        mode?: string;
        amount?: number;
        fees?: number;
      };
    };
  };
  created_at?: number;
}

@Controller('api/v1/razorpay/webhook')
export class RazorpayWebhookController {
  private readonly logger = new Logger(RazorpayWebhookController.name);

  constructor(
    private readonly walletsService: WalletsService,
    private readonly configService: ConfigService,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
    @InjectRepository(PaymentLog)
    private readonly paymentLogRepo: Repository<PaymentLog>,
    @InjectRepository(UserPaymentDetail)
    private readonly paymentDetailRepo: Repository<UserPaymentDetail>,
  ) {}

  private verifySignature(rawBody: string, signature: string): boolean {
    const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('[Webhook] No RAZORPAY_WEBHOOK_SECRET configured — skipping verification');
      return true; // Skip in dev if not configured
    }
    const crypto = require('crypto') as typeof import('crypto');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    // Use timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: RazorpayWebhookPayload,
    @Req() req: Request,
  ) {
    // Read raw body for signature verification
    const rawBody =
      (req as any).rawBody ??
      JSON.stringify(body);

    const signature = (req.headers['x-razorpay-signature'] as string) ?? '';

    if (signature && !this.verifySignature(rawBody, signature)) {
      this.logger.warn('[Webhook] Invalid signature — rejecting request');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = String(body.event ?? '');

    this.logger.log(`[Razorpay Webhook] Received event: ${event}`);

    // ── Handle ₹1 verification payment captured ─────────────────────────────
    if (event === 'payment.captured') {
      await this.handleVerificationSuccess(body);
      return { received: true };
    }

    if (event === 'payment.failed') {
      await this.handleVerificationFailure(body);
      return { received: true };
    }

    // ── Handle withdrawal payout processed ──────────────────────────────────
    if (event === 'payout.processed') {
      await this.handlePayoutSuccess(body);
      return { received: true };
    }

    // ── Handle withdrawal payout rejected ───────────────────────────────────
    if (event === 'payout.rejected') {
      await this.handlePayoutFailure(body);
      return { received: true };
    }

    return { received: true };
  }

  /**
   * Handle payment.captured webhook — marks a payment detail as verified.
   */
  private async handleVerificationSuccess(body: RazorpayWebhookPayload) {
    const payment = body.payload?.payment?.entity;
    if (!payment) {
      this.logger.warn('[Razorpay Webhook] No payment entity in captured event');
      return;
    }

    const paymentDetailId = payment.notes?.payment_detail_id;
    if (!paymentDetailId) {
      this.logger.warn('[Razorpay Webhook] No payment_detail_id in notes');
      return;
    }

    this.logger.log(`[Razorpay Webhook] Verification captured | detailId=${paymentDetailId}`);

    await this.walletsService.handleVerificationCallback({
      orderId: `rzp_pl_${paymentDetailId}`,
      success: true,
      pinelabsTransactionId: payment.id,
    });
  }

  /**
   * Handle payment.failed webhook — marks a payment detail as failed.
   */
  private async handleVerificationFailure(body: RazorpayWebhookPayload) {
    const payment = body.payload?.payment?.entity;
    if (!payment) return;

    const paymentDetailId = payment.notes?.payment_detail_id;
    if (!paymentDetailId) {
      this.logger.warn('[Razorpay Webhook] No payment_detail_id in failed payment notes');
      return;
    }

    this.logger.warn(`[Razorpay Webhook] Verification failed | detailId=${paymentDetailId}`);

    await this.walletsService.handleVerificationCallback({
      orderId: `rzp_pl_${paymentDetailId}`,
      success: false,
      errorCode: 'PAYMENT_FAILED',
      errorMessage: payment.status ?? 'Payment failed',
      pinelabsTransactionId: payment.id,
    });
  }

  /**
   * Handle payout.processed webhook — marks withdrawal as completed.
   */
  private async handlePayoutSuccess(body: RazorpayWebhookPayload) {
    const payload = body.payload?.payout?.entity;
    if (!payload) {
      this.logger.warn('[Razorpay Webhook] No payout entity in payload');
      return;
    }

    const payoutId = payload.id ?? '';
    const status = payload.status ?? '';
    const referenceId = payload.reference_id ?? '';

    this.logger.log(
      `[Razorpay Webhook] payoutId=${payoutId} status=${status} ref=${referenceId}`,
    );

    if (!referenceId) {
      this.logger.warn('[Razorpay Webhook] No reference_id in payout');
      return;
    }

    const withdrawalId = referenceId.replace(/^wd_/, '');

    const withdrawal = await this.withdrawalRepo.findOne({ where: { id: withdrawalId } });
    if (!withdrawal) {
      this.logger.warn(`[Webhook] Withdrawal not found: ${withdrawalId}`);
      return;
    }

    const finalStatus =
      status === 'processed' || status === 'completed'
        ? WithdrawalStatus.COMPLETED
        : status === 'failed' || status === 'rejected'
        ? WithdrawalStatus.FAILED
        : withdrawal.status;

    const isSuccess = finalStatus === WithdrawalStatus.COMPLETED;

    await this.withdrawalRepo.update(withdrawalId, {
      status: finalStatus,
      processedAt: isSuccess ? new Date() : withdrawal.processedAt,
    });

    const existingLog = await this.paymentLogRepo.findOne({
      where: { razorpayPayoutId: payoutId },
    });

    if (!existingLog) {
      const log = this.paymentLogRepo.create({
        withdrawalRequestId: withdrawalId,
        orderId: referenceId,
        razorpayPayoutId: payoutId,
        status: isSuccess ? PaymentLogStatus.SUCCESS : PaymentLogStatus.FAILED,
        rawResponse: body as unknown as Record<string, unknown>,
      });
      await this.paymentLogRepo.save(log);
    }

    this.logger.log(
      `[Razorpay Webhook] Withdrawal ${withdrawalId} updated to ${finalStatus}`,
    );
  }

  /**
   * Handle payout.rejected webhook — marks withdrawal as failed.
   */
  private async handlePayoutFailure(body: RazorpayWebhookPayload) {
    const payload = body.payload?.payout?.entity;
    if (!payload) {
      this.logger.warn('[Razorpay Webhook] No payout entity in rejected payout');
      return;
    }

    const payoutId = payload.id ?? '';
    const referenceId = payload.reference_id ?? '';
    const reason = (payload as any).remarks ?? payload.status ?? 'Rejected by bank';

    this.logger.warn(
      `[Razorpay Webhook] Payout rejected | payoutId=${payoutId} ref=${referenceId} reason=${reason}`,
    );

    if (!referenceId) {
      this.logger.warn('[Razorpay Webhook] No reference_id in rejected payout');
      return;
    }

    const withdrawalId = referenceId.replace(/^wd_/, '');

    const withdrawal = await this.withdrawalRepo.findOne({ where: { id: withdrawalId } });
    if (!withdrawal) {
      this.logger.warn(`[Webhook] Withdrawal not found: ${withdrawalId}`);
      return;
    }

    await this.withdrawalRepo.update(withdrawalId, {
      status: WithdrawalStatus.FAILED,
      processedAt: new Date(),
    });

    const existingLog = await this.paymentLogRepo.findOne({
      where: { razorpayPayoutId: payoutId },
    });

    if (!existingLog) {
      const log = this.paymentLogRepo.create({
        withdrawalRequestId: withdrawalId,
        orderId: referenceId,
        razorpayPayoutId: payoutId,
        status: PaymentLogStatus.FAILED,
        rawResponse: body as unknown as Record<string, unknown>,
      });
      await this.paymentLogRepo.save(log);
    }

    this.logger.log(`[Razorpay Webhook] Withdrawal ${withdrawalId} marked FAILED`);
  }
}