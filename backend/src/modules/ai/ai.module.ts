import { Module } from '@nestjs/common';
import { GemmaService } from './services/gemma.service';
import { EmbedService } from './services/embed.service';
import { AnveshanScoringService } from './services/anveshan-scoring.service';

@Module({
  providers: [GemmaService, EmbedService, AnveshanScoringService],
  exports: [GemmaService, EmbedService, AnveshanScoringService],
})
export class AiModule {}