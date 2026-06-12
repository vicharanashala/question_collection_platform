import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { User, UserCropDetail, AuditLog } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserCropDetail, AuditLog])],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}