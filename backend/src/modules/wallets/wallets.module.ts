import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { DbModule } from '../../shared/database/db.module';
import { AdminModule } from '../admin/admin.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    forwardRef(() => AdminModule),
    forwardRef(() => PaymentModule),
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService],
})
export class WalletsModule {}