/**
 * Pre-configured rate limit presets derived from environment variables.
 *
 * Controllers use these to keep limits in sync with ConfigService env vars — do NOT
 * hardcode literal values in @RateLimit() decorators.
 *
 * Controllers inject via @Inject('RATE_LIMIT_PRESETS').
 *
 * @example
 * // auth.controller.ts
 * @RateLimit(...RATE_LIMIT_PRESETS.OTP)
 * async requestOtp(@Body() dto: RequestOtpDto) { ... }
 *
 * // question.controller.ts
 * @RateLimit(...RATE_LIMIT_PRESETS.SUBMISSION)
 * async submitQuestion() { ... }
 */

import { ConfigService } from '@nestjs/config';

export interface RateLimitPreset {
  limit: number;
  windowSeconds: number;
  /** Key prefix — either a static string or a function receiving { params, query, body, user }. */
  keyPrefix?: string | ((args: Record<string, unknown>) => string);
}

export interface RateLimitPresets {
  OTP: RateLimitPreset;
  LOGIN: RateLimitPreset;
  SUBMISSION: RateLimitPreset;
  ADMIN: RateLimitPreset;
  PUBLIC: RateLimitPreset;
}

let _presets: RateLimitPresets | null = null;

/**
 * Initialize and return rate limit presets wired to ConfigService.
 * Cached after first call — safe to call repeatedly.
 */
export function getRateLimitPresets(configService: ConfigService): RateLimitPresets {
  if (_presets) return _presets;

  _presets = {
    OTP: {
      limit: configService.get<number>('redis.rateLimitOtpPerMin') ?? 3,
      windowSeconds: 60,
      keyPrefix: (args: Record<string, unknown>) => {
        const body = args.body as Record<string, unknown> | undefined;
        return `otp:${body?.mobileNumber ?? 'unknown'}`;
      },
    },
    LOGIN: {
      limit: configService.get<number>('redis.rateLimitLoginPerMin') ?? 5,
      windowSeconds: 60,
      // Infer from route + IP when keyPrefix is undefined
      keyPrefix: undefined,
    },
    SUBMISSION: {
      limit: configService.get<number>('redis.rateLimitSubmissionPerMin') ?? 10,
      windowSeconds: 60,
      keyPrefix: (args: Record<string, unknown>) => {
        const user = args.user as { id: number } | undefined;
        return `submission:u${user?.id ?? 'anon'}`;
      },
    },
    ADMIN: {
      limit: configService.get<number>('redis.rateLimitAdminPerMin') ?? 100,
      windowSeconds: 60,
      keyPrefix: (args: Record<string, unknown>) => {
        const user = args.user as { id: number } | undefined;
        return `admin:u${user?.id ?? 'anon'}`;
      },
    },
    PUBLIC: {
      limit: configService.get<number>('redis.rateLimitPublicPerMin') ?? 60,
      windowSeconds: 60,
      keyPrefix: undefined,
    },
  };

  return _presets;
}