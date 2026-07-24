import { SetMetadata } from '@nestjs/common';

export const CACHE_TTL_KEY = 'cache_ttl';
export const CACHE_KEY_PREFIX_KEY = 'cache_key_prefix';
export const CACHE_TTL_SECONDS_KEY = 'cache_ttl_seconds';

/**
 * Mark an endpoint response as cacheable in Redis.
 *
 * @param keyPrefix   Key prefix; use a string or a function returning a string.
 *                    The function receives the route params (e.g. { id: '123' }).
 * @param ttlSeconds  Cache TTL in seconds (defaults to 60).
 *
 * @example
 * @Cacheable('users', 300)
 * async getUsers() { ... }
 */
export const Cacheable = (
  keyPrefix: string | ((args: unknown[]) => string),
  ttlSeconds = 60,
) => SetMetadata(CACHE_TTL_KEY, { keyPrefix, ttlSeconds });

/**
 * Mark an endpoint as bypassing cache (opt-out).
 * Useful when a route inherits @Cacheable from a controller-level setting.
 */
export const BypassCache = () => SetMetadata('bypass_cache', true);