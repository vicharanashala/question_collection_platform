import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { Question, AuditLog, Notification } from '../database/entities';
import { UserModule } from '../user/user.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question, AuditLog, Notification]),
    UserModule,
    AdminModule,
  ],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}