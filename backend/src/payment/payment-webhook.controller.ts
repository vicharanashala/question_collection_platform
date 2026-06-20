import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Headers,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinelabsService } from './pinelabs.service';
import { WalletsService } from '../wallets/wallets.service';
import { PaymentLog, WithdrawalRequest } from '../database/entities';
import { PaymentLogStatus, WithdrawalStatus } from '../common/enums';

@Controller('api/webhooks/pinelabs')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly pinelabsService: PinelabsService,
    private readonly walletsService: WalletsService,
    @InjectRepository(PaymentLog)
    private readonly paymentLogRepo: Repository<PaymentLog>,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawalRepo: Repository<WithdrawalRequest>,
  ) {}

  /**
   * PineLabs async webhook for payment status updates.
   *
   * Two order ID spaces:
   *  - VF_<id>_* : verification micro-transactions  → WalletsService.handleVerificationCallback
   *  - PL_<id>_* : withdrawal payouts               → mark withdrawal completed / log failure
   *
   * Documented callback body (success):
   *   { order_id, status, signature }
   *
   * Documented callback body (failure):
   *   { order_id, status, error_code, error_message, signature }
   *
   * The status field values per docs: AUTHORIZED, FAILED, etc.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-pinelabs-signature') pineSignature: string | undefined,
  ): Promise<{ received: boolean }> {
    // Support both snake_case (documented) and camelCase field names
    const orderId = String(body['order_id'] ?? body['orderId'] ?? '');
    const status = String(body['status'] ?? '').toUpperCase();
    const errorCode = body['error_code'] ? String(body['error_code']) : undefined;
    const errorMessage = body['error_message'] ? String(body['error_message']) : undefined;
    const transactionId = String(body['transaction_id'] ?? body['txn_id'] ?? '');

    if (!orderId) {
      this.logger.warn('[Webhook] Missing orderId, ignoring');
      return { received: true };
    }

    this.logger.log(`[Webhook] orderId=${orderId} status=${status} txnId=${transactionId}`);

    // ─── Verify webhook signature (optional but recommended) ────────────────
    if (pineSignature) {
      const isValid = this.pinelabsService.verifyPaymentSignature({
        orderId,
        status: String(body['status'] ?? ''),
        errorCode,
        errorMessage,
        receivedSignature: pineSignature,
      });
      if (!isValid) {
        this.logger.warn(`[Webhook] Invalid signature for orderId=${orderId}, ignoring`);
        return { received: true };
      }
    }

    const orderType = this.pinelabsService.parseOrderIdType(orderId);

    if (orderType === 'verification') {
      // Route to payment detail verification handler
      const isSuccess = ['AUTHORIZED', 'SUCCESS', 'COMPLETED', 'ACCEPTED'].includes(status);
      await this.walletsService.handleVerificationCallback({
        orderId,
        success: isSuccess,
        errorCode: isSuccess ? undefined : (errorCode ?? 'VERIFICATION_FAILED'),
        errorMessage: isSuccess ? undefined : (errorMessage ?? 'Verification payout failed'),
        pinelabsTransactionId: transactionId || undefined,
      });
      return { received: true };
    }

    // All other order IDs → withdrawal payout webhook

    // For AUTHORIZED status (pre-auth), do not mark COMPLETED yet.
    // The admin must call captureOrder via the Capture API to finalize.
    if (status === 'AUTHORIZED') {
      this.logger.log(`[Webhook] Order AUTHORIZED (pending capture) | orderId=${orderId}`);
      // Update withdrawal with AUTHORIZED status but keep PROCESSING
      await this.withdrawalRepo.update({ orderId }, { status: WithdrawalStatus.PROCESSING });
      return { received: true };
    }

    const withdrawal = await this.withdrawalRepo.findOne({ where: { orderId } });

    if (!withdrawal) {
      this.logger.warn(`[Webhook] No withdrawal found for orderId=${orderId}`);
      return { received: true };
    }

    const isSuccess = ['AUTHORIZED', 'SUCCESS', 'COMPLETED', 'ACCEPTED'].includes(status);

    if (isSuccess) {
      await this.withdrawalRepo.update(withdrawal.id, {
        status: WithdrawalStatus.COMPLETED,
        processedAt: new Date(),
        pinelabsTransactionId: transactionId || null,
      });

      const log = this.paymentLogRepo.create({
        withdrawalRequestId: withdrawal.id,
        orderId,
        pinelabsTransactionId: transactionId || null,
        status: PaymentLogStatus.SUCCESS,
        rawResponse: body,
      });
      await this.paymentLogRepo.save(log);

      this.logger.log(`[Webhook] Withdrawal ${withdrawal.id} marked COMPLETED`);
    } else {
      // Failure — log error but do NOT auto-mark FAILED (per task spec):
      // admin must manually review and trigger refund.
      const log = this.paymentLogRepo.create({
        withdrawalRequestId: withdrawal.id,
        orderId,
        pinelabsTransactionId: transactionId || null,
        status: PaymentLogStatus.FAILED,
        errorCode: errorCode ?? 'WEBHOOK_FAILURE',
        errorMessage: errorMessage ?? 'Webhook indicated failure',
        rawResponse: body,
      });
      await this.paymentLogRepo.save(log);

      this.logger.warn(`[Webhook] Withdrawal ${withdrawal.id} payment failed — logged only (admin must manually review)`);
    }

    return { received: true };
  }
}