// Shared DI token keys — used with Inversify or any DI container.
// Until the DI container is fully wired, this file also serves as documentation
// for the well-known service identifiers across the application.

export const TYPES = {
  // ─── Database ────────────────────────────────────────────────────────────
  DATA_SOURCE: 'DATA_SOURCE',

  // ─── Cache / Redis ───────────────────────────────────────────────────────
  REDIS_CLIENT: 'REDIS_CLIENT',
  CACHE_SERVICE: 'CACHE_SERVICE',
  SESSION_SERVICE: 'SESSION_SERVICE',
  HOT_DATA_SERVICE: 'HOT_DATA_SERVICE',
  ANALYTICS_CACHE_SERVICE: 'ANALYTICS_CACHE_SERVICE',
  QUERY_CACHE_SERVICE: 'QUERY_CACHE_SERVICE',
  DUPLICATE_DETECTION_SERVICE: 'DUPLICATE_DETECTION_SERVICE',
  CACHE_WARMUP_SERVICE: 'CACHE_WARMUP_SERVICE',

  // ─── Auth ────────────────────────────────────────────────────────────────
  JWT_STRATEGY: 'JWT_STRATEGY',
  SMS_SERVICE: 'SMS_SERVICE',

  // ─── External Services ───────────────────────────────────────────────────
  STORAGE_SERVICE: 'STORAGE_SERVICE',
  AI_EMBED_SERVICE: 'AI_EMBED_SERVICE',
  AI_GDB_SERVICE: 'AI_GDB_SERVICE',
  AI_GEMMA_SERVICE: 'AI_GEMMA_SERVICE',
  SPEECH_SERVICE: 'SPEECH_SERVICE',
  LGD_SERVICE: 'LGD_SERVICE',
  RAZORPAY_PAYOUT_SERVICE: 'RAZORPAY_PAYOUT_SERVICE',
  PINELABS_SERVICE: 'PINELABS_SERVICE',

  // ─── Observability ───────────────────────────────────────────────────────
  SENTRY_SERVICE: 'SENTRY_SERVICE',
} as const;