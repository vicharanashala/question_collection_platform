import { Logger, Module } from '@nestjs/common';
import { QuestionController } from './controllers/question.controller';
import { QuestionService } from './services/question.service';
import { AnveshanMilestoneService } from './services/anveshan-milestone.service';
import { AnveshanScorePollerService } from './services/anveshan-score-poller.service';
import { UserModule } from '../user/user.module';
import { AdminModule } from '../admin/admin.module';
import { StorageModule } from '../storage/storage.module';
import { AiModule } from '../ai/ai.module';
import { GdbModule } from '../ai/gdb.module';
import { DbModule } from '../../shared/database/db.module';
import { AgriEntitiesModule } from '../agri-entities/agri-entities.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AuditService } from '../audit-logs/services/audit.service';

@Module({
  imports: [
    DbModule,
    UserModule,
    AdminModule,
    StorageModule,
    AiModule,
    GdbModule,
    AgriEntitiesModule,
    AuditLogsModule
  ],
  controllers: [QuestionController],
  providers: [QuestionService, AnveshanMilestoneService, AnveshanScorePollerService, AuditService, Logger],
  exports: [QuestionService, AnveshanMilestoneService],
})
export class QuestionModule {}