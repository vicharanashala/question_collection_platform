import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { AppModule } from '../../../src/app.module';
import { GemmaService } from '../../../src/ai/gemma.service';
import { GdbService } from '../../../src/ai/gdb.service';
import { SarvamService } from '../../../src/speech/sarvam.service';

type CreateTestAppResult = {
  app: INestApplication;
  gemmaService: GemmaService;
  gdbService: GdbService;
};

export async function createTestApp(): Promise<CreateTestAppResult> {
  const gemmaService = {
    inferCropAndDomains: vi.fn().mockResolvedValue({
      crop: 'soybean',
      domains: ['crop_protection'],
      confidence: 0.95,
    }),
  } as unknown as GemmaService;

  const gdbService = {
    checkDuplicate: vi.fn().mockResolvedValue({
      isDuplicate: false,
      matchedQuestion: null,
      matchedAnswer: null,
      similarityScore: null,
      rawResponse: null,
    }),
  } as unknown as GdbService;

  const sarvamService = {
    transcribeBuffer: vi.fn().mockResolvedValue({
      text: 'test transcript',
      confidence: 1,
      languageCode: 'mr-IN',
    }),
    translateText: vi.fn().mockResolvedValue({
      translatedText: 'translated text',
      confidence: 1,
      sourceLanguage: 'en-IN',
      targetLanguage: 'mr-IN',
    }),
  } as unknown as SarvamService;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(GemmaService)
    .useValue(gemmaService)
    .overrideProvider(GdbService)
    .useValue(gdbService)
    .overrideProvider(SarvamService)
    .useValue(sarvamService)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
  globalThis.nestApp = app;

  return { app, gemmaService, gdbService };
}
