import { Module } from '@nestjs/common';
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
} from '../database/entities';

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
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}