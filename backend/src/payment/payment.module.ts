import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinelabsService } from './pinelabs.service';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentLog } from '../database/entities/payment-log.entity';
import { WithdrawalRequest } from '../database/entities/withdrawal-request.entity';
import { Wallet } from '../database/entities/wallet.entity';
import { Transaction } from '../database/entities/transaction.entity';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [
    ConfigModule, // for PinelabsService (reads payment.config)
    TypeOrmModule.forFeature([PaymentLog, WithdrawalRequest, Wallet, Transaction]),
    forwardRef(() => WalletsModule),
  ],
  controllers: [PaymentWebhookController],
  providers: [PinelabsService],
  exports: [PinelabsService],
})
export class PaymentModule {}