import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { Wallet, Transaction, WithdrawalRequest, AuditLog, UserPaymentDetail } from '../database/entities';
import { AdminModule } from '../admin/admin.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, WithdrawalRequest, AuditLog, UserPaymentDetail]),
    forwardRef(() => AdminModule),
    forwardRef(() => PaymentModule),
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}