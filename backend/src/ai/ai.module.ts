import { Module } from '@nestjs/common';
import { GemmaService } from './gemma.service';

@Module({
  providers: [GemmaService],
  exports: [GemmaService],
})
export class AiModule {}