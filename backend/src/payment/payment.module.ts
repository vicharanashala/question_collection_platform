import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinelabsService } from './pinelabs.service';
import { RazorpayPayoutService } from './razorpay-payout.service';
import { PaymentWebhookController } from './payment-webhook.controller';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { PaymentLog } from '../database/entities/payment-log.entity';
import { WithdrawalRequest } from '../database/entities/withdrawal-request.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { UserPaymentDetail } from '../database/entities/user-payment-detail.entity';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    ConfigModule, // for PinelabsService and RazorpayPayoutService (reads payment.config)
    TypeOrmModule.forFeature([PaymentLog, WithdrawalRequest, Wallet, Transaction, UserPaymentDetail]),
    forwardRef(() => WalletsModule),
  ],
  controllers: [PaymentWebhookController, RazorpayWebhookController],
  providers: [PinelabsService, RazorpayPayoutService],
  exports: [PinelabsService, RazorpayPayoutService],
})
export class PaymentModule {}