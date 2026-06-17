import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User, UserCropDetail, AuditLog, Notification } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserCropDetail, AuditLog, Notification])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}