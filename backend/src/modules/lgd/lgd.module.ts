import { Module } from '@nestjs/common';
import { LgdService } from './lgd.service';
import { LgdController } from './lgd.controller';

@Module({
  controllers: [LgdController],
  providers: [LgdService],
  exports: [LgdService],
})
export class LgdModule {}