import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLog, AuditLogSchema } from '@/shared/database/mongodb/schemas/audit-log.schema';
import { MongoAuditLogRepository } from '@/shared/database/repositories/impl/mongo/audit-log.repository.mongo';
import { AuditService } from './services/audit.service';
import { AuditLogsController } from './controllers/audit.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
  ],
  controllers: [AuditLogsController],
  providers: [MongoAuditLogRepository, AuditService],
  exports: [AuditService],
})
export class AuditLogsModule {}