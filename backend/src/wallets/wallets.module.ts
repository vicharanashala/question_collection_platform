import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { Wallet, Transaction, WithdrawalRequest, AuditLog, UserPaymentDetail, User } from '../database/entities';
import { AdminModule } from '../admin/admin.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Wallet, Transaction, WithdrawalRequest, AuditLog, UserPaymentDetail, User]),
    forwardRef(() => AdminModule),
    forwardRef(() => PaymentModule),
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}