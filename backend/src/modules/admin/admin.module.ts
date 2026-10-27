import { Logger, Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AnveshanProgressService } from './anveshan-progress.service';
import { AnveshanUserDetailController } from './anveshan-user-detail.controller';
import { AnveshanUserDetailService } from './anveshan-user-detail.service';
import { CuratorController } from './curator.controller';
import { CuratorService } from './curator.service';
import { AnalyticsController, ExportController } from './analytics.controller';
import { DbModule } from '../../shared/database/db.module';
import { WalletsModule } from '../wallets/wallets.module';
import { NotificationsModule } from '../notification/notifications.module';
import { PaymentModule } from '../payment/payment.module';
import { GdbModule } from '../ai/gdb.module';
import { AuditService } from '../audit-logs/audit.service';
import { UserService } from '../user/user.service';
import { SessionService } from '../session/session.service';

@Module({
  imports: [
    DbModule,
    forwardRef(() => WalletsModule),
    NotificationsModule,
    PaymentModule,
    forwardRef(() => GdbModule),
  ],
  controllers: [
    AdminController,
    AnalyticsController,
    ExportController,
    CuratorController,
    AnveshanUserDetailController,
  ],
  providers: [
    AdminService,
    CuratorService,
    AnveshanProgressService,
    AnveshanUserDetailService,
    AuditService,
    Logger,
    UserService,
    SessionService
  ],
  exports: [AdminService, AnveshanProgressService],
})
export class AdminModule {}

