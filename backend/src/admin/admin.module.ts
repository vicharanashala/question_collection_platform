import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AnalyticsController, ExportController } from './analytics.controller';
import {
  User,
  Question,
  Wallet,
  Transaction,
  WithdrawalRequest,
  AuditLog,
  AdminConfig,
  Notification,
  PaymentLog,
  UserPaymentDetail,
} from '../database/entities';
import { WalletsModule } from '../wallets/wallets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Question,
      Wallet,
      Transaction,
      WithdrawalRequest,
      AuditLog,
      AdminConfig,
      Notification,
      PaymentLog,
      UserPaymentDetail,
    ]),
    forwardRef(() => WalletsModule),
    NotificationsModule,
    PaymentModule,
  ],
  controllers: [AdminController, AnalyticsController, ExportController, AuditController],
  providers: [AdminService, AuditService],
  exports: [AdminService],
})
export class AdminModule {}