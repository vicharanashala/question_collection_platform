import { Module } from '@nestjs/common';
import { SpeechController } from './speech.controller';
import { SarvamService } from './sarvam.service';

@Module({
  controllers: [SpeechController],
  providers: [SarvamService],
  exports: [SarvamService],
})
export class SpeechModule {}