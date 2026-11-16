import { Logger, Module } from '@nestjs/common';
import { DbModule } from '../../shared/database/db.module';
import { FaqsController } from './controllers/faqs.controller';
import { FaqsService } from './services/faqs.service';
import { AuditService } from '../audit-logs/services/audit.service';

@Module({
  imports: [DbModule],
  controllers: [FaqsController],
  providers: [FaqsService, AuditService, Logger],
  exports: [FaqsService],
})
export class FaqsModule {}