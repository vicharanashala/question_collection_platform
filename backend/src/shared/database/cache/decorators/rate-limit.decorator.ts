import { SetMetadata } from '@nestjs/common';

export interface RateLimitMeta {
  limit: number;
  windowSeconds: number;
  /** Key prefix string, or a function that receives the full request context. */
  keyPrefix?: string | ((args: Record<string, unknown>) => string);
}

/**
 * Apply Redis-backed rate limiting to an endpoint.
 *
 * @param limit          Max requests allowed within the window.
 * @param windowSeconds  Time window in seconds.
 * @param keyPrefix      Optional. Pass a string for static keys, or a function for dynamic keys
 *                       (receives { params, query, body, user }). Falls back to inferring from route.
 *
 * @example
 * // OTP: 3 per minute, keyed by mobile number from body
 * @RateLimit(3, 60, (ctx) => `otp:${ctx.body?.mobileNumber}`)
 * async requestOtp(@Body() dto: RequestOtpDto) { ... }
 *
 * // Submission: 10 per minute, keyed by authenticated user
 * @RateLimit(10, 60)
 * async submitQuestion() { ... }
 */
export const RateLimit = (
  limit: number,
  windowSeconds: number,
  keyPrefix?: string | ((args: Record<string, unknown>) => string),
) => SetMetadata('rate_limit', { limit, windowSeconds, keyPrefix } as RateLimitMeta);