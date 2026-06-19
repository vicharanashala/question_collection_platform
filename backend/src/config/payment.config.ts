import { registerAs } from '@nestjs/config';

export const paymentConfig = registerAs('payment', () => ({
  pinelabs: {
    env: process.env.PINELABS_ENV ?? 'sandbox',
    merchantId: process.env.PINELABS_MERCHANT_ID ?? '',
    apiKey: process.env.PINELABS_API_KEY ?? '',
    secretKey: process.env.PINELABS_SECRET_KEY ?? '',
    baseUrl:
      process.env.PINELABS_ENV === 'production'
        ? 'https://api.pinelabs.com'
        : 'https://api.preprod.pinelabs.com',
    webhookSecret: process.env.PINELABS_WEBHOOK_SECRET ?? '',
    // When true, verification is auto-approved immediately without calling PineLabs.
    // Useful in dev/demo environments without live PineLabs credentials.
    mockVerification: process.env.PINELABS_MOCK_VERIFICATION === 'true',
  },
}));