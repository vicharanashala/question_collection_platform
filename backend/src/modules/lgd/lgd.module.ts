import { Module } from '@nestjs/common';
import { LgdService } from './services/lgd.service';
import { LgdController } from './controllers/lgd.controller';

@Module({
  controllers: [LgdController],
  providers: [LgdService],
  exports: [LgdService],
})
export class LgdModule {}