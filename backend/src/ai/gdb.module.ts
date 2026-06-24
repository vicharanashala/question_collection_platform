import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Question } from '../database/entities';
import { GdbService } from './gdb.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Question]),
    AdminModule, // for AdminService.getConfigValue()
  ],
  providers: [GdbService],
  exports: [GdbService],
})
export class GdbModule {}