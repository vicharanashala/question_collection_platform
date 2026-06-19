import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
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
   * Two order ID spaces:
   *  - VF_<id>_* : verification micro-transactions  → WalletsService.handleVerificationCallback
   *  - PL_<id>_* : withdrawal payouts               → mark withdrawal completed / log failure
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: Record<string, unknown>): Promise<{ received: boolean }> {
    const orderId = String(body['order_id'] ?? body['orderId'] ?? '');
    const status = String(body['status'] ?? '').toLowerCase();

    if (!orderId) {
      this.logger.warn('[Webhook] Missing orderId, ignoring');
      return { received: true };
    }

    this.logger.log(`[Webhook] orderId=${orderId} status=${status}`);

    const orderType = this.pinelabsService.parseOrderIdType(orderId);

    if (orderType === 'verification') {
      // Route to payment detail verification handler
      const isSuccess = status === 'success' || status === 'completed' || status === 'accepted' || status === 'SUCCESS';
      await this.walletsService.handleVerificationCallback({
        orderId,
        success: isSuccess,
        errorCode: isSuccess ? undefined : String(body['error_code'] ?? 'VERIFICATION_FAILED'),
        errorMessage: isSuccess ? undefined : String(body['error_message'] ?? 'Verification payout failed'),
        pinelabsTransactionId: String(body['transaction_id'] ?? body['txn_id'] ?? ''),
      });
      return { received: true };
    }

    // All other order IDs → withdrawal payout webhook
    const withdrawal = await this.withdrawalRepo.findOne({ where: { orderId } });

    if (!withdrawal) {
      this.logger.warn(`[Webhook] No withdrawal found for orderId=${orderId}`);
      return { received: true };
    }

    const isSuccess =
      status === 'success' ||
      status === 'completed' ||
      status === 'accepted' ||
      status === 'SUCCESS';

    if (isSuccess) {
      await this.withdrawalRepo.update(withdrawal.id, {
        status: WithdrawalStatus.COMPLETED,
        processedAt: new Date(),
        pinelabsTransactionId: String(body['transaction_id'] ?? body['txn_id'] ?? null),
      });

      const log = this.paymentLogRepo.create({
        withdrawalRequestId: withdrawal.id,
        orderId,
        pinelabsTransactionId: String(body['transaction_id'] ?? body['txn_id'] ?? null),
        status: PaymentLogStatus.SUCCESS,
        rawResponse: body,
      });
      await this.paymentLogRepo.save(log);

      this.logger.log(`[Webhook] Withdrawal ${withdrawal.id} marked COMPLETED`);
    } else {
      const log = this.paymentLogRepo.create({
        withdrawalRequestId: withdrawal.id,
        orderId,
        pinelabsTransactionId: String(body['transaction_id'] ?? body['txn_id'] ?? null) || null,
        status: PaymentLogStatus.FAILED,
        errorCode: String(body['error_code'] ?? 'WEBHOOK_FAILURE'),
        errorMessage: String(body['error_message'] ?? 'Webhook indicated failure'),
        rawResponse: body,
      });
      await this.paymentLogRepo.save(log);

      this.logger.warn(`[Webhook] Withdrawal ${withdrawal.id} payment failed — logged only`);
    }

    return { received: true };
  }
}