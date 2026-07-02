/**
 * Centralized cache key builder.
 * All Redis keys across the application must go through these functions
 * to prevent collisions and enforce a consistent naming convention.
 *
 * Pattern: {domain}:{entity}:{id}:{variant}
 */

// ─── Session keys ─────────────────────────────────────────────────────────────

/** e.g. session:123:device-abc */
export function sessionKey(userId: number, deviceId: string): string {
  return `session:${userId}:${deviceId}`;
}

/** Wildcard pattern for all sessions of a user. */
export function sessionPattern(userId: number): string {
  return `session:${userId}:*`;
}

// ─── Metadata keys ────────────────────────────────────────────────────────────

/** e.g. meta:reward_tiers */
export function metaKey(name: string): string {
  return `meta:${name}`;
}

/** Wildcard pattern for all metadata. */
export const META_PATTERN = 'meta:*';

// ─── Query cache keys ─────────────────────────────────────────────────────────

/**
 * e.g. query:leaderboard:weekly
 * @param name Query name/label
 * @param params Unique params part (e.g. weekly, state:KA, crop:paddy)
 */
export function queryKey(name: string, params?: string): string {
  return params ? `query:${name}:${params}` : `query:${name}`;
}

/** Wildcard prefix for a given query name. */
export function queryPattern(name: string): string {
  return `query:${name}:*`;
}

/** Wildcard for all query cache. */
export const QUERY_PATTERN = 'query:*';

// ─── Analytics keys ───────────────────────────────────────────────────────────

/** e.g. analytics:daily:2026-07-02 */
export function analyticsDailyKey(date: string): string {
  return `analytics:daily:${date}`;
}

/** e.g. analytics:monthly:2026-07 */
export function analyticsMonthlyKey(month: string): string {
  return `analytics:monthly:${month}`;
}

/** e.g. analytics:realtime:today:submissions */
export function analyticsRealtimeKey(metric: string): string {
  return `analytics:realtime:today:${metric}`;
}

// ─── Leaderboard keys ─────────────────────────────────────────────────────────

/** Top users sorted set. */
export const LEADERBOARD_KEY = 'leaderboard:top_users';

// ─── Duplicate detection keys ─────────────────────────────────────────────────

/**
 * Per-user exact-duplicate question gate.
 * Scope: per-user so one user cannot block another.
 * Key is permanent (no TTL) — cleared only on question deletion.
 *
 * @param userId  Submitting user
 * @param state   State code (e.g. KA, MH)
 * @param crop    Crop code (e.g. rice, wheat)
 * @param normalizedText Lowercase, trimmed question text
 */
export function dupKey(userId: number, state: string, crop: string, normalizedText: string): string {
  return `dup:${userId}:${state}:${crop}:${normalizedText}`;
}

// ─── Rate limiting keys ───────────────────────────────────────────────────────

/** e.g. ratelimit:otp:919876543210 */
export function rateLimitKey(action: string, identifier: string): string {
  return `ratelimit:${action}:${identifier}`;
}

// ─── Hot data keys ────────────────────────────────────────────────────────────

/** Hot top-N users list (refreshed every 5 min). */
export const HOT_LEADERBOARD_KEY = 'hot:leaderboard:top100';

/** Hot reward tiers (refreshed every hour). */
export const HOT_REWARD_TIERS_KEY = 'hot:reward_tiers';

/** Hot today's submission count (refreshed every minute). */
export const HOT_TODAY_SUBMISSIONS_KEY = 'hot:today:submissions';

/** Hot today's approval count (refreshed every minute). */
export const HOT_TODAY_APPROVALS_KEY = 'hot:today:approvals';

/** Hot platform total approved questions (refreshed every minute). */
export const HOT_TOTAL_APPROVED_KEY = 'hot:total_approved';

// ─── User / wallet cache keys ─────────────────────────────────────────────────

/** e.g. user:123 */
export function userKey(userId: number): string {
  return `user:${userId}`;
}

/** e.g. wallet:123 */
export function walletKey(userId: number): string {
  return `wallet:${userId}`;
}

// ─── Cache flush helper ───────────────────────────────────────────────────────

export type KeyPrefix = 'session' | 'meta' | 'query' | 'analytics' | 'leaderboard' | 'dup' | 'ratelimit' | 'hot' | 'user' | 'wallet';
export const ALL_PATTERNS: Record<KeyPrefix, string> = {
  session: 'session:*',
  meta: 'meta:*',
  query: 'query:*',
  analytics: 'analytics:*',
  leaderboard: 'leaderboard:*',
  dup: 'dup:*',
  ratelimit: 'ratelimit:*',
  hot: 'hot:*',
  user: 'user:*',
  wallet: 'wallet:*',
};