import { Logger, Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { DistributorController } from './distributor.controller';
import { DistributorService } from './distributor.service';
import { AuditService } from '../audit-logs/audit.service';

@Module({
  imports: [DbModule],
  controllers: [DistributorController],
  providers: [DistributorService, AuditService, Logger],
  exports: [DistributorService],
})
export class DistributorModule {}