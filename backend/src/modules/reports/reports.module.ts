import { Logger, Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AuditService } from '../audit-logs/audit.service';

@Module({
  imports: [DbModule],
  controllers: [ReportsController],
  providers: [ReportsService, AuditService, Logger],
  exports: [ReportsService],
})
export class ReportsModule {}