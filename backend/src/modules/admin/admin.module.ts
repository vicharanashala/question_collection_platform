import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { CuratorController } from './curator.controller';
import { CuratorService } from './curator.service';
import { AnalyticsController, ExportController } from './analytics.controller';
import { DbModule } from '../../shared/database/db.module';
import { WalletsModule } from '../wallets/wallets.module';
import { NotificationsModule } from '../notification/notifications.module';
import { PaymentModule } from '../payment/payment.module';
import { GdbModule } from '../ai/gdb.module';

@Module({
  imports: [
    DbModule,
    forwardRef(() => WalletsModule),
    NotificationsModule,
    PaymentModule,
    forwardRef(() => GdbModule),
  ],
  controllers: [AdminController, AnalyticsController, ExportController, AuditController, CuratorController],
  providers: [AdminService, AuditService, CuratorService],
  exports: [AdminService],
})
export class AdminModule {}