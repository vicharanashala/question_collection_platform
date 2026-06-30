/**
 * Centralised app configuration.
 * All runtime constants that vary between environments live here.
 * Expo: EXPO_PUBLIC_* vars are injected by Metro/webpack at build time via process.env.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env: Record<string, string | undefined> = process.env as any;

export const config = {
  support: {
    email: env.EXPO_PUBLIC_SUPPORT_EMAIL,
    whatsapp: env.EXPO_PUBLIC_SUPPORT_WHATSAPP,
  },
  dev: {
    /** When true, auto-approves UPI and bank payment methods without any real verification. */
    autoVerifyPaymentMethods: env.EXPO_PUBLIC_AUTO_VERIFY_PAYMENT_METHODS === 'true',
  },
} as const;