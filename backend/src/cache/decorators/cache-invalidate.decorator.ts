import { SetMetadata } from '@nestjs/common';

/**
 * Invalidate one or more cache key patterns after a mutation endpoint succeeds.
 * Runs after the handler returns successfully.
 *
 * @param patterns  One or more key patterns to delete. Supports Redis SCAN patterns.
 *
 * @example
 * @CacheInvalidate('users', 'wallets')
 * async updateUser() { ... }
 */
export const CacheInvalidate = (...patterns: string[]) =>
  SetMetadata('cache_invalidate_patterns', patterns);