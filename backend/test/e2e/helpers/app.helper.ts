import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { vi } from 'vitest';
import { AppModule } from '../../../src/app.module';
import { GemmaService } from '../../../src/modules/ai/gemma.service';
import { GdbService } from '../../../src/modules/ai/gdb.service';
import { EmbedService } from '../../../src/modules/ai/embed.service';
import { SarvamService } from '../../../src/modules/speech/sarvam.service';
import { RazorpayPayoutService } from '../../../src/modules/payment/razorpay-payout.service';

type CreateTestAppResult = {
  app: INestApplication;
  gemmaService: GemmaService;
  gdbService: GdbService;
  embedService: EmbedService;
  sarvamService: SarvamService;
  razorpayPayoutService: RazorpayPayoutService;
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

  const embedService = {
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  } as unknown as EmbedService;

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

  const razorpayPayoutService = {
    createFundAccount: vi.fn().mockResolvedValue({
      fundAccountId: 'fa_test_default',
      contactId: 'ct_test_default',
      active: true,
    }),
    initiatePayout: vi.fn().mockResolvedValue({
      payoutId: 'po_test_default',
      status: 'processing',
      utrNumber: null,
    }),
    createContact: vi.fn().mockResolvedValue({ contactId: 'ct_test_default', active: true }),
    validateFundAccount: vi.fn().mockResolvedValue({ validationId: 'val_default', fundAccountId: 'fa_test_default', status: 'completed', active: true }),
    getFundAccountValidationStatus: vi.fn().mockResolvedValue({ validationId: 'val_default', status: 'completed', active: true }),
  } as unknown as RazorpayPayoutService;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(GemmaService)
    .useValue(gemmaService)
    .overrideProvider(GdbService)
    .useValue(gdbService)
    .overrideProvider(EmbedService)
    .useValue(embedService)
    .overrideProvider(SarvamService)
    .useValue(sarvamService)
    .overrideProvider(RazorpayPayoutService)
    .useValue(razorpayPayoutService)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();
  globalThis.nestApp = app;

  return { app, gemmaService, gdbService, embedService, sarvamService, razorpayPayoutService };
}
