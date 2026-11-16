import { Module } from '@nestjs/common';
import { SpeechController } from './controllers/speech.controller';
import { SarvamService } from './services/sarvam.service';

@Module({
  controllers: [SpeechController],
  providers: [SarvamService],
  exports: [SarvamService],
})
export class SpeechModule {}