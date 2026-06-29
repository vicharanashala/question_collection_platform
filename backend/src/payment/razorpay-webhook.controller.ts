import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  WithdrawalRequest,
  PaymentLog,
  Transaction,
  UserPaymentDetail,
} from '../database/entities';
import { WithdrawalStatus, PaymentLogStatus, TransactionStatus } from '../common/enums';
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

@Controller('razorpay/webhook')
@Public() // Razorpay sends webhooks without JWT — bypass global JwtAuthGuard
export class RazorpayWebhookController {
  private readonly logger = new Logger(RazorpayWebhookController.name);

  constructor(
    private readonly walletsService: WalletsService,
    private readonly configService: ConfigService,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
    @InjectRepository(PaymentLog)
    private readonly paymentLogRepo: Repository<PaymentLog>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
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
  @UsePipes(new ValidationPipe({ forbidNonWhitelisted: false }))
  async handleWebhook(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    // Read raw body for signature verification
    const rawBody =
      (req as any).rawBody ??
      JSON.stringify(body);

    const signature = (req.headers['x-razorpay-signature'] as string) ?? '';

    this.logger.debug(`[Webhook] RAW BODY: ${rawBody}`);
    this.logger.debug(`[Webhook] SIGNATURE HEADER: ${signature}`);

    if (signature && !this.verifySignature(rawBody, signature)) {
      this.logger.warn('[Webhook] Invalid signature — rejecting request');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.debug('[Webhook] Signature verification passed');

    const event = String(body.event ?? '');

    this.logger.log(`[Razorpay Webhook] Received event: ${event}`);
    this.logger.debug(`[Webhook] FULL BODY: ${JSON.stringify(body)}`);

    // ── Handle ₹1 verification payment captured ─────────────────────────────
    if (event === 'payment.captured') {
      this.logger.debug('[Webhook] Routing to handleVerificationSuccess');
      await this.handleVerificationSuccess(body);
      return { received: true };
    }

    if (event === 'payment.failed') {
      this.logger.debug('[Webhook] Routing to handleVerificationFailure');
      await this.handleVerificationFailure(body);
      return { received: true };
    }

    // ── Handle fund account validation completed ──────────────────────────────
    if (event === 'fund_account.validation.completed') {
      this.logger.debug('[Webhook] Routing to handleFundAccountValidationCompleted');
      await this.handleFundAccountValidationCompleted(body);
      return { received: true };
    }

    // ── Handle fund account validation failed ─────────────────────────────────
    if (event === 'fund_account.validation.failed') {
      this.logger.debug('[Webhook] Routing to handleFundAccountValidationFailed');
      await this.handleFundAccountValidationFailed(body);
      return { received: true };
    }

    // ── Handle withdrawal payout processed ──────────────────────────────────
    if (event === 'payout.processed') {
      this.logger.debug('[Webhook] Routing to handlePayoutSuccess');
      await this.handlePayoutSuccess(body);
      return { received: true };
    }

    // ── Handle withdrawal payout rejected ───────────────────────────────────
    if (event === 'payout.rejected') {
      this.logger.debug('[Webhook] Routing to handlePayoutFailure');
      await this.handlePayoutFailure(body);
      return { received: true };
    }

    // ── Handle payout reversed (money sent but returned to our account) ─────
    if (event === 'payout.reversed') {
      this.logger.debug('[Webhook] Routing to handlePayoutReversed');
      await this.handlePayoutReversed(body);
      return { received: true };
    }

    this.logger.debug(`[Webhook] No handler for event: ${event} — returning 200`);
    return { received: true };
  }

  /**
   * Handle payment.captured webhook — marks a payment detail as verified.
   */
  private async handleVerificationSuccess(body: Record<string, unknown>) {
    this.logger.debug('[handleVerificationSuccess] Started');
    const payload = body.payload as Record<string, unknown> | undefined;
    const payment = payload?.payment as Record<string, unknown> | undefined;
    const entity = payment?.entity as Record<string, unknown> | undefined;
    if (!entity) {
      this.logger.warn('[Razorpay Webhook] No payment entity in captured event');
      return;
    }

    this.logger.debug(`[handleVerificationSuccess] entity: ${JSON.stringify(entity)}`);

    const notes = entity.notes as Record<string, string> | undefined;
    const paymentDetailId = notes?.payment_detail_id;
    if (!paymentDetailId) {
      this.logger.warn('[Razorpay Webhook] No payment_detail_id in notes');
      return;
    }

    this.logger.debug(`[handleVerificationSuccess] paymentDetailId=${paymentDetailId}`);
    this.logger.log(`[Razorpay Webhook] Verification captured | detailId=${paymentDetailId}`);

    await this.walletsService.handleVerificationCallback({
      orderId: `rzp_pl_${paymentDetailId}`,
      success: true,
      pinelabsTransactionId: entity.id as string | undefined,
    });
  }

  /**
   * Handle payment.failed webhook — marks a payment detail as failed.
   */
  private async handleVerificationFailure(body: Record<string, unknown>) {
    this.logger.debug('[handleVerificationFailure] Started');
    const payload = body.payload as Record<string, unknown> | undefined;
    const payment = payload?.payment as Record<string, unknown> | undefined;
    const entity = payment?.entity as Record<string, unknown> | undefined;
    if (!entity) {
      this.logger.warn('[handleVerificationFailure] No payment entity in failed event');
      return;
    }

    this.logger.debug(`[handleVerificationFailure] entity: ${JSON.stringify(entity)}`);

    const notes = entity.notes as Record<string, string> | undefined;
    const paymentDetailId = notes?.payment_detail_id;
    if (!paymentDetailId) {
      this.logger.warn('[Razorpay Webhook] No payment_detail_id in failed payment notes');
      return;
    }

    this.logger.debug(`[handleVerificationFailure] paymentDetailId=${paymentDetailId}`);
    this.logger.warn(`[Razorpay Webhook] Verification failed | detailId=${paymentDetailId}`);

    await this.walletsService.handleVerificationCallback({
      orderId: `rzp_pl_${paymentDetailId}`,
      success: false,
      errorCode: 'PAYMENT_FAILED',
      errorMessage: entity.status as string ?? 'Payment failed',
      pinelabsTransactionId: entity.id as string | undefined,
    });
  }

  /**
   * Handle payout.processed webhook — marks withdrawal as completed.
   */
  private async handlePayoutSuccess(body: Record<string, unknown>) {
    const payload = body.payload as Record<string, unknown> | undefined;
    const payout = payload?.payout as Record<string, unknown> | undefined;
    const entity = payout?.entity as Record<string, unknown> | undefined;
    if (!entity) {
      this.logger.warn('[Razorpay Webhook] No payout entity in payload');
      return;
    }

    this.logger.debug('[handlePayoutSuccess] Started');
    const payoutId = String(entity.id ?? '');
    const status = String(entity.status ?? '');
    const referenceId = String(entity.reference_id ?? '');

    this.logger.debug(`[handlePayoutSuccess] entity: ${JSON.stringify(entity)}`);
    this.logger.log(
      `[Razorpay Webhook] payoutId=${payoutId} status=${status} ref=${referenceId}`,
    );

    if (!referenceId) {
      this.logger.warn('[Razorpay Webhook] No reference_id in payout');
      return;
    }

    const withdrawalId = referenceId.replace(/^wd_/, '');
    this.logger.debug(`[handlePayoutSuccess] withdrawalId=${withdrawalId}`);

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

    // Also update the corresponding transaction from PENDING → COMPLETED
    if (isSuccess) {
      const txUpdated = await this.transactionRepo.update(
        { referenceId: withdrawalId, status: TransactionStatus.PENDING },
        { status: TransactionStatus.COMPLETED },
      );
      this.logger.debug(`[handlePayoutSuccess] transaction updated rows=${txUpdated.affected}`);
    }

    this.logger.debug(`[handlePayoutSuccess] Looking up payment_log for payoutId=${payoutId}`);
    const existingLog = await this.paymentLogRepo.findOne({
      where: { razorpayPayoutId: payoutId },
    });
    this.logger.debug(`[handlePayoutSuccess] payment_log exists: ${!!existingLog}`);

    if (!existingLog) {
      const log = this.paymentLogRepo.create({
        withdrawalRequestId: withdrawalId,
        orderId: referenceId,
        razorpayPayoutId: payoutId,
        status: isSuccess ? PaymentLogStatus.SUCCESS : PaymentLogStatus.FAILED,
        rawResponse: body as unknown as Record<string, unknown>,
      });
      await this.paymentLogRepo.save(log);
      this.logger.debug(`[handlePayoutSuccess] payment_log created`);
    } else {
      this.logger.debug(`[handlePayoutSuccess] payment_log already exists — skipping`);
    }

    this.logger.debug(`[handlePayoutSuccess] Completed`);
    this.logger.log(
      `[Razorpay Webhook] Withdrawal ${withdrawalId} updated to ${finalStatus}`,
    );
  }

  /**
   * Handle payout.rejected webhook — marks withdrawal as failed.
   */
  private async handlePayoutFailure(body: Record<string, unknown>) {
    this.logger.debug('[handlePayoutFailure] Started');
    const payload = body.payload as Record<string, unknown> | undefined;
    const payout = payload?.payout as Record<string, unknown> | undefined;
    const entity = payout?.entity as Record<string, unknown> | undefined;
    if (!entity) {
      this.logger.warn('[Razorpay Webhook] No payout entity in rejected payout');
      return;
    }

    this.logger.debug(`[handlePayoutFailure] entity: ${JSON.stringify(entity)}`);

    const payoutId = String(entity.id ?? '');
    const referenceId = String(entity.reference_id ?? '');
    const reason = (entity.remarks as string) ?? String(entity.status ?? 'Rejected by bank');

    this.logger.debug(`[handlePayoutFailure] payoutId=${payoutId} ref=${referenceId} reason=${reason}`);
    this.logger.warn(
      `[Razorpay Webhook] Payout rejected | payoutId=${payoutId} ref=${referenceId} reason=${reason}`,
    );

    if (!referenceId) {
      this.logger.warn('[Razorpay Webhook] No reference_id in rejected payout');
      return;
    }

    const withdrawalId = referenceId.replace(/^wd_/, '');
    this.logger.debug(`[handlePayoutFailure] withdrawalId=${withdrawalId}`);

    const withdrawal = await this.withdrawalRepo.findOne({ where: { id: withdrawalId } });
    if (!withdrawal) {
      this.logger.warn(`[Webhook] Withdrawal not found: ${withdrawalId}`);
      return;
    }

    this.logger.debug(`[handlePayoutFailure] Updating withdrawal to FAILED`);
    await this.withdrawalRepo.update(withdrawalId, {
      status: WithdrawalStatus.FAILED,
      processedAt: new Date(),
    });

    this.logger.debug(`[handlePayoutFailure] Looking up payment_log for payoutId=${payoutId}`);
    const existingLog = await this.paymentLogRepo.findOne({
      where: { razorpayPayoutId: payoutId },
    });
    this.logger.debug(`[handlePayoutFailure] payment_log exists: ${!!existingLog}`);

    if (!existingLog) {
      const log = this.paymentLogRepo.create({
        withdrawalRequestId: withdrawalId,
        orderId: referenceId,
        razorpayPayoutId: payoutId,
        status: PaymentLogStatus.FAILED,
        rawResponse: body as unknown as Record<string, unknown>,
      });
      await this.paymentLogRepo.save(log);
      this.logger.debug(`[handlePayoutFailure] payment_log created`);
    } else {
      this.logger.debug(`[handlePayoutFailure] payment_log already exists — skipping`);
    }

    this.logger.debug(`[handlePayoutFailure] Completed`);
    this.logger.log(`[Razorpay Webhook] Withdrawal ${withdrawalId} marked FAILED`);
  }

  /**
   * Handle payout.reversed webhook — payout was sent but returned to our account.
   *
   * This is different from payout.rejected (which never left our account).
   * Here the money left, bounced back, so we must CREDIT it back to the user's wallet
   * and mark the withdrawal as FAILED.
   *
   * Razorpay docs: payout.reversed means the payout was reversed after being processed
   * (e.g. beneficiary bank rejected it post-credit).
   */
  private async handlePayoutReversed(body: Record<string, unknown>) {
    this.logger.debug('[handlePayoutReversed] Started');
    const payload = body.payload as Record<string, unknown> | undefined;
    const payout = payload?.payout as Record<string, unknown> | undefined;
    const entity = payout?.entity as Record<string, unknown> | undefined;
    if (!entity) {
      this.logger.warn('[Razorpay Webhook] No payout entity in payout.reversed event');
      return;
    }

    this.logger.debug(`[handlePayoutReversed] entity: ${JSON.stringify(entity)}`);

    const payoutId = String(entity.id ?? '');
    const status = String(entity.status ?? '');
    const referenceId = String(entity.reference_id ?? '');
    // Reason is usually in remarks or a nested error object
    const reason = (entity.remarks as string)
      ?? (entity.failure_reason as string)
      ?? String(entity.status ?? 'Payout was reversed — funds returned to your account');

    this.logger.debug(`[handlePayoutReversed] payoutId=${payoutId} status=${status} ref=${referenceId} reason=${reason}`);
    this.logger.warn(
      `[Razorpay Webhook] Payout REVERSED | payoutId=${payoutId} status=${status} ref=${referenceId} reason=${reason}`,
    );

    if (!referenceId) {
      this.logger.warn('[Razorpay Webhook] No reference_id in payout.reversed — cannot locate withdrawal');
      return;
    }

    const withdrawalId = referenceId.replace(/^wd_/, '');
    this.logger.debug(`[handlePayoutReversed] withdrawalId=${withdrawalId}`);

    const withdrawal = await this.withdrawalRepo.findOne({ where: { id: withdrawalId } });
    if (!withdrawal) {
      this.logger.warn(`[Razorpay Webhook] Withdrawal not found: ${withdrawalId}`);
      return;
    }

    this.logger.debug(`[handlePayoutReversed] withdrawal found: ${JSON.stringify({ id: withdrawal.id, status: withdrawal.status, amount: withdrawal.amount, walletId: withdrawal.walletId })}`);

    // ── Check if reversal was already processed ──────────────────────────────
    if (withdrawal.status === WithdrawalStatus.FAILED || withdrawal.status === WithdrawalStatus.REVERSED) {
      this.logger.log(`[Razorpay Webhook] Withdrawal ${withdrawalId} already processed as ${withdrawal.status} — skipping`);
      return;
    }

    // ── Idempotent: find existing log for this payout ─────────────────────────
    this.logger.debug(`[handlePayoutReversed] Looking up payment_log for payoutId=${payoutId}`);
    let existingLog = await this.paymentLogRepo.findOne({
      where: { razorpayPayoutId: payoutId },
    });
    this.logger.debug(`[handlePayoutReversed] payment_log exists: ${!!existingLog}`);

    // ── Credit the amount back to the user's wallet ───────────────────────────
    this.logger.debug(`[handlePayoutReversed] Crediting ₹${withdrawal.amount} back to wallet ${withdrawal.walletId}`);
    const wallet = await this.walletsService.creditReversedWithdrawal(
      withdrawal.walletId,
      withdrawal.amount,
      withdrawalId,
      payoutId,
    );
    this.logger.debug(`[handlePayoutReversed] Wallet after credit: ${JSON.stringify(wallet)}`);

    // ── Mark withdrawal as REVERSED (distinct from plain FAILED) ───────────────
    await this.withdrawalRepo.update(withdrawalId, {
      status: WithdrawalStatus.REVERSED,
      processedAt: new Date(),
      failureReason: reason,
    });

    // ── Log the reversal in payment_logs ──────────────────────────────────────
    const log = this.paymentLogRepo.create({
      withdrawalRequestId: withdrawalId,
      orderId: referenceId,
      razorpayPayoutId: payoutId,
      status: PaymentLogStatus.REVERSED,
      errorCode: 'PAYOUT_REVERSED',
      errorMessage: reason,
      rawResponse: body as unknown as Record<string, unknown>,
    });
    await this.paymentLogRepo.save(log);
    this.logger.debug(`[handlePayoutReversed] payment_log created`);

    this.logger.debug(`[handlePayoutReversed] Completed`);
    this.logger.log(
      `[Razorpay Webhook] Reversal complete — ₹${withdrawal.amount} credited to wallet ${withdrawal.walletId} | withdrawal=${withdrawalId}`,
    );
  }

  /**
   * Handle fund_account.validation.completed webhook — marks a payment detail as verified.
   *
   * Razorpay fires this when Fund Account Validation (POST /v1/fund_accounts/validations)
   * succeeds. We mark the detail verified and persist any account-holder name returned
   * by Razorpay (from the bank's records) so it can be displayed to the user.
   */
  private async handleFundAccountValidationCompleted(body: Record<string, unknown>) {
    this.logger.debug('[handleFundAccountValidationCompleted] Started');

    const payload = body.payload as Record<string, unknown> | undefined;
    const validationWrapper = payload?.['fund_account.validation'] as Record<string, unknown> | undefined;
    const validation = validationWrapper?.entity as Record<string, unknown> | undefined;
    if (!validation) {
      this.logger.warn('[Razorpay Webhook] No fund_account.validation.entity in validation.completed event');
      return;
    }

    const validationId = String(validation.id ?? '');
    const status = String(validation.status ?? '');
    const notes = validation.notes as Record<string, string> | undefined;
    const paymentDetailId = notes?.payment_detail_id;
    const results = validation.results as Record<string, unknown> | undefined;
    const registeredName = results?.registered_name as string | null | undefined;

    this.logger.debug(
      `[handleFundAccountValidationCompleted] validationId=${validationId} status=${status} registeredName=${registeredName} detailId=${paymentDetailId}`,
    );
    this.logger.log(
      `[Razorpay Webhook] Fund account validation completed | validationId=${validationId} | detailId=${paymentDetailId}`,
    );

    if (!paymentDetailId) {
      this.logger.warn('[Razorpay Webhook] No payment_detail_id in fund_account.validation.completed notes');
      return;
    }

    await this.walletsService.handleVerificationCallback({
      orderId: `rzp_pl_${paymentDetailId}`,
      success: true,
      registeredName: registeredName ?? undefined,
    });
  }

  /**
   * Handle fund_account.validation.failed webhook — marks a payment detail as failed.
   *
   * Possible reasons include: invalid IFSC, account does not exist, bank not reachable.
   */
  private async handleFundAccountValidationFailed(body: Record<string, unknown>) {
    this.logger.debug('[handleFundAccountValidationFailed] Started');

    const payload = body.payload as Record<string, unknown> | undefined;
    const validationWrapper = payload?.['fund_account.validation'] as Record<string, unknown> | undefined;
    const validation = validationWrapper?.entity as Record<string, unknown> | undefined;
    if (!validation) {
      this.logger.warn('[Razorpay Webhook] No fund_account.validation.entity in validation.failed event');
      return;
    }

    const validationId = String(validation.id ?? '');
    const notes = validation.notes as Record<string, string> | undefined;
    const paymentDetailId = notes?.payment_detail_id;
    const statusDetails = validation.status_details as Record<string, unknown> | undefined;
    const reason = (statusDetails?.reason as string) ?? String(validation.status ?? 'Validation failed');

    this.logger.debug(
      `[handleFundAccountValidationFailed] validationId=${validationId} reason=${reason} detailId=${paymentDetailId}`,
    );
    this.logger.warn(
      `[Razorpay Webhook] Fund account validation failed | validationId=${validationId} | reason=${reason}`,
    );

    if (!paymentDetailId) {
      this.logger.warn('[Razorpay Webhook] No payment_detail_id in fund_account.validation.failed notes');
      return;
    }

    await this.walletsService.handleVerificationCallback({
      orderId: `rzp_pl_${paymentDetailId}`,
      success: false,
      errorCode: 'VALIDATION_FAILED',
      errorMessage: reason,
    });
  }
}