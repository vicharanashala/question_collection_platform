import { Module } from '@nestjs/common';
import { GemmaService } from './gemma.service';
import { EmbedService } from './embed.service';

@Module({
  providers: [GemmaService, EmbedService],
  exports: [GemmaService, EmbedService],
})
export class AiModule {}