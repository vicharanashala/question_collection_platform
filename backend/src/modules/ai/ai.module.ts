import { Module } from '@nestjs/common';
import { GemmaService } from './gemma.service';
import { EmbedService } from './embed.service';
import { AnveshanScoringService } from './anveshan-scoring.service';

@Module({
  providers: [GemmaService, EmbedService, AnveshanScoringService],
  exports: [GemmaService, EmbedService, AnveshanScoringService],
})
export class AiModule {}