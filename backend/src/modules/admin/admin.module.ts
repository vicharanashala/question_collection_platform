import { Logger, Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { AnveshanProgressService } from './services/anveshan-progress.service';
import { AnveshanUserDetailController } from './controllers/anveshan-user-detail.controller';
import { AnveshanUserDetailService } from './services/anveshan-user-detail.service';
import { CuratorController } from './controllers/curator.controller';
import { CuratorService } from './services/curator.service';
import { AnalyticsController, ExportController } from './controllers/analytics.controller';
import { DbModule } from '../../shared/database/db.module';
import { WalletsModule } from '../wallets/wallets.module';
import { PaymentModule } from '../payment/payment.module';
import { GdbModule } from '../ai/gdb.module';
import { AuditService } from '../audit-logs/services/audit.service';
import { UserService } from '../user/services/user.service';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    DbModule,
    forwardRef(() => WalletsModule),
    PaymentModule,
    forwardRef(() => GdbModule),
    SessionModule,
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
  ],
  exports: [AdminService, AnveshanProgressService],
})
export class AdminModule {}

