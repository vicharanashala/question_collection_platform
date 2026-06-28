import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { SystemContent } from '../database/entities/system-content.entity';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { AuditLog } from '../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemContent, AuditLog]),
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}