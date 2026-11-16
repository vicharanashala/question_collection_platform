import { Logger, Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { ReportsController } from './controllers/reports.controller';
import { ReportsService } from './services/reports.service';
import { AuditService } from '../audit-logs/services/audit.service';

@Module({
  imports: [DbModule],
  controllers: [ReportsController],
  providers: [ReportsService, AuditService, Logger],
  exports: [ReportsService],
})
export class ReportsModule {}