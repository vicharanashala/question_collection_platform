/**
 * Centralised app configuration.
 * All runtime constants that vary between environments live here.
 * Expo: EXPO_PUBLIC_* vars are injected by Metro/webpack at build time via process.env.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env: Record<string, string | undefined> = process.env as any;

export const config = {
  support: {
    email: env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@kisandekho.com',
    whatsapp: env.EXPO_PUBLIC_SUPPORT_WHATSAPP ?? '919876543210',
  },
} as const;