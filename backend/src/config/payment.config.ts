import { registerAs } from '@nestjs/config';

export const paymentConfig = registerAs('payment', () => ({
  pinelabs: {
    env: process.env.PINELABS_ENV ?? 'sandbox',
    merchantId: process.env.PINELABS_MERCHANT_ID ?? '',
    clientId: process.env.PINELABS_CLIENT_ID ?? '',
    clientSecret: process.env.PINELABS_CLIENT_SECRET ?? '',

    baseUrl:
      process.env.PINELABS_ENV === 'production'
        ? 'https://api.pluralpay.in'
        : 'https://pluraluat.v2.pinepg.in',
    webhookSecret: process.env.PINELABS_WEBHOOK_SECRET ?? '',
    // When true, verification is auto-approved immediately without calling PineLabs.
    // Useful in dev/demo environments without live PineLabs credentials.
    mockVerification: process.env.PINELABS_MOCK_VERIFICATION === 'true',
  },
  razorpay: {
    env: process.env.RAZORPAY_ENV ?? 'sandbox',
    apiKey: process.env.RAZORPAY_API_KEY ?? '',
    secret: process.env.RAZORPAY_SECRET ?? '',
    accountNumber: process.env.RAZORPAY_ACCOUNT_NUMBER ?? '',
  },
}));
