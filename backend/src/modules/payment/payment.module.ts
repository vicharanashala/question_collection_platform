import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PinelabsService } from './pinelabs.service';
import { RazorpayPayoutService } from './razorpay-payout.service';
import { PaymentWebhookController } from './payment-webhook.controller';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { DbModule } from '../../shared/database/db.module';

@Module({
  imports: [
    ConfigModule, // for PinelabsService and RazorpayPayoutService (reads payment.config)
    DbModule,
    forwardRef(() => WalletsModule),
  ],
  controllers: [PaymentWebhookController, RazorpayWebhookController],
  providers: [PinelabsService, RazorpayPayoutService],
  exports: [PinelabsService, RazorpayPayoutService],
})
export class PaymentModule {}