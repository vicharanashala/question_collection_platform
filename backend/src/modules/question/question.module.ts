import { Module } from '@nestjs/common';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { UserModule } from '../user/user.module';
import { AdminModule } from '../admin/admin.module';
import { StorageModule } from '../storage/storage.module';
import { AiModule } from '../ai/ai.module';
import { GdbModule } from '../ai/gdb.module';
import { DbModule } from '../../shared/database/db.module';

@Module({
  imports: [
    DbModule,
    UserModule,
    AdminModule,
    StorageModule,
    AiModule,
    GdbModule,
  ],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}