import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinelabsService } from './pinelabs.service';
import { RazorpayPayoutService } from './razorpay-payout.service';
import { PaymentWebhookController } from './payment-webhook.controller';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { PaymentLog } from '../../shared/database/entities/payment-log.entity';
import { WithdrawalRequest } from '../../shared/database/entities/withdrawal-request.entity';
import { Wallet } from '../../shared/database/entities/wallet.entity';
import { Transaction } from '../../shared/database/entities/transaction.entity';
import { UserPaymentDetail } from '../../shared/database/entities/user-payment-detail.entity';
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