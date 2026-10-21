import { Logger, Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { FaqsController } from './faqs.controller';
import { FaqsService } from './faqs.service';
import { AuditService } from '../audit-logs/audit.service';

@Module({
  imports: [DbModule],
  controllers: [FaqsController],
  providers: [FaqsService, AuditService, Logger],
  exports: [FaqsService],
})
export class FaqsModule {}