import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { Question, AuditLog, Notification } from '../database/entities';
import { UserModule } from '../user/user.module';
import { AdminModule } from '../admin/admin.module';
import { StorageModule } from '../storage/storage.module';
import { AiModule } from '../ai/ai.module';
import { GdbModule } from '../ai/gdb.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, AuditLog, Notification]),
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