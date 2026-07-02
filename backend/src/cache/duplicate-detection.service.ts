import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { dupKey } from './cache.keys';

/**
 * Fast exact-duplicate question detection using Redis.
 *
 * Flow:
 *  1. On submit:  EXISTS dup:{userId}:{state}:{crop}:{normalized_text}
 *     → exists → 409 Conflict (fast gate, no DB hit)
 *     → not exists → proceed to DB
 *  2. After successful DB insert: SETNX dup:... (permanent, no TTL)
 *  3. On question deletion: DEL dup:...
 *
 * Normalization: trim, lowercase, remove leading/trailing punctuation.
 */
@Injectable()
export class DuplicateDetectionService {
  private readonly logger = new Logger(DuplicateDetectionService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Check if a question with identical content already exists for this user.
   * Returns true if duplicate detected, false otherwise.
   *
   * @throws ConflictException (HTTP 409) — when a duplicate is found.
   *                           The caller should forward this to the client.
   */
  async checkDuplicate(
    userId: number,
    state: string,
    crop: string,
    questionText: string,
  ): Promise<boolean> {
    const normalized = this.normalize(questionText);
    const key = dupKey(userId, state, crop, normalized);

    const exists = await this.redis.exists(key);
    if (exists === 1) {
      this.logger.debug(`Duplicate detected: key=${key}`);
      throw new ConflictException(
        'A question with this exact content has already been submitted. Please check your previously asked questions.',
      );
    }
    return false;
  }

  /**
   * Record a newly created question in Redis.
   * Uses SETNX so it does NOT overwrite if a key somehow already exists.
   */
  async recordQuestion(
    userId: number,
    state: string,
    crop: string,
    questionText: string,
  ): Promise<void> {
    const normalized = this.normalize(questionText);
    const key = dupKey(userId, state, crop, normalized);
    // NX = only set if not exists; permanent key (no TTL)
    await this.redis.setnx(key, '1');
  }

  /**
   * Remove a question's duplicate key on deletion / soft-delete.
   */
  async removeQuestion(
    userId: number,
    state: string,
    crop: string,
    questionText: string,
  ): Promise<void> {
    const normalized = this.normalize(questionText);
    const key = dupKey(userId, state, crop, normalized);
    await this.redis.del(key);
  }

  /**
   * Normalize question text for consistent duplicate detection.
   * Mirrors the normalization used in recordQuestion().
   */
  normalize(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/^[\s\.,;:!?\'\"\(\)\[\]{}]+/, '')   // strip leading punctuation
      .replace(/[\s\.,;:!?\'\"\(\)\[\]{}]+$/, '')   // strip trailing punctuation
      .replace(/\s+/g, ' ');                          // collapse internal whitespace
  }
}