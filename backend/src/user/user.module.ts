import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User, AuditLog, Notification, Question, Transaction } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog, Notification, Question, Transaction])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}