import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.service';

const createMockConfigService = (overrides: Record<string, string | undefined> = {}) => {
  const map: Record<string, string | undefined> = {
    'sms.provider': 'mock',
    'sms.apiKey': '',
    'sms.senderId': 'AGRIAPP',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => map[key]),
  };
};

const buildModule = (overrides: Record<string, string | undefined> = {}) => {
  return Test.createTestingModule({
    providers: [
      SmsService,
      { provide: ConfigService, useValue: createMockConfigService(overrides) },
    ],
  });
};

describe('SmsService', () => {
  let service: SmsService;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(async () => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    const module: TestingModule = await buildModule().compile();
    service = module.get<SmsService>(SmsService);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  // ─── Mock provider ─────────────────────────────────────────────────────────

  describe('SMS_PROVIDER=mock', () => {
    it('should log OTP to console without calling any external API', async () => {
      const module: TestingModule = await buildModule({ 'sms.provider': 'mock' }).compile();
      service = module.get<SmsService>(SmsService);

      await service.sendOtp('9876543210', '123456');

      expect(consoleLogSpy).toHaveBeenCalledWith('[MOCK SMS] To: 9876543210 | OTP: 123456');
    });

    it('should return successfully even if no API key is set', async () => {
      const module: TestingModule = await buildModule({ 'sms.provider': 'mock' }).compile();
      service = module.get<SmsService>(SmsService);

      await expect(service.sendOtp('9876543210', '999999')).resolves.toBeUndefined();
    });

    it('should handle phone number with +91 prefix', async () => {
      const module: TestingModule = await buildModule({ 'sms.provider': 'mock' }).compile();
      service = module.get<SmsService>(SmsService);

      await service.sendOtp('+919876543210', '456789');

      expect(consoleLogSpy).toHaveBeenCalledWith('[MOCK SMS] To: +919876543210 | OTP: 456789');
    });
  });

  // ─── Fast2SMS provider ──────────────────────────────────────────────────────

  describe('SMS_PROVIDER=fast2sms', () => {
    it('should throw if SMS_API_KEY is not set', async () => {
      const module: TestingModule = await buildModule({ 'sms.provider': 'fast2sms', 'sms.apiKey': '' }).compile();
      service = module.get<SmsService>(SmsService);

      await expect(service.sendOtp('9876543210', '123456')).rejects.toThrow(
        'Fast2SMS API key not configured',
      );
    });
  });

  // ─── Provider routing ───────────────────────────────────────────────────────

  describe('provider routing', () => {
    it.each([
      ['mock', 'MOCK SMS'],
      ['fast2sms', 'Fast2SMS'],
      ['msg91', 'MSG91'],
      ['twilio', 'Twilio'],
      ['gupshup', 'Gupshup'],
    ])('should route to %s provider when SMS_PROVIDER=%s', async (provider, expectedLogPrefix) => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const module: TestingModule = await buildModule({ 'sms.provider': provider as string, 'sms.apiKey': '' }).compile();
      service = module.get<SmsService>(SmsService);

      await service.sendOtp('9876543210', '123456');

      if (provider === 'mock') {
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[MOCK SMS]'));
      } else {
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`[${expectedLogPrefix}]`));
      }

      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });
});