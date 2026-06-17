import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import {
  User,
  Question,
  Wallet,
  Transaction,
  WithdrawalRequest,
  AuditLog,
  AdminConfig,
  Notification,
} from '../database/entities';
import { WalletsModule } from '../wallets/wallets.module';

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
    ]),
    forwardRef(() => WalletsModule),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}