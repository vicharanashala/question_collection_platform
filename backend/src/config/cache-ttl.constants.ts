/**
 * Centralized cache TTL constants.
 * Import these directly wherever cache TTL is needed.
 * No env vars or configuration.ts required.
 */

export const CacheTTL = {
  // ─── Question endpoints ────────────────────────────────
  QUESTIONS_LIST:       300,   // 5 minutes
  QUESTION_DETAIL:      600,   // 10 minutes

  // ─── User endpoints ────────────────────────────────────
  USER_PROFILE:         600,   // 10 minutes
  USER_LIST:            300,   // 5 minutes

  // ─── Wallet endpoints ──────────────────────────────────
  WALLET_BALANCE:       60,    // 1 minute  (financial — shorter TTL)
  WALLET_HISTORY:       300,   // 5 minutes

  // ─── Session ───────────────────────────────────────────
  SESSION_DAYS:         30,    // days (not seconds)

  // ─── Query cache ───────────────────────────────────────
  QUERY_CACHE:          300,   // 5 minutes

  // ─── Leaderboard ───────────────────────────────────────
  LEADERBOARD:          300,   // 5 minutes

  // ─── Metadata (admin config, reward tiers) ─────────────
  METADATA:             3600,  // 1 hour

  // ─── Analytics ─────────────────────────────────────────
  ANALYTICS_REALTIME:   60,    // 1 minute
  ANALYTICS_DAILY:      600,   // 10 minutes
  ANALYTICS_MONTHLY:    1800,  // 30 minutes

  // ─── Admin ─────────────────────────────────────────────
  ADMIN_STATS:          60,    // 1 minute
  ADMIN_CACHE_FLUSH:    0,     // 0 = no cache
} as const;

export type CacheTTLKey = keyof typeof CacheTTL;