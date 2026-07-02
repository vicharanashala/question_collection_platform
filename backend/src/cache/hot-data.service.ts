import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from './redis.service';
import {
  LEADERBOARD_KEY,
  HOT_LEADERBOARD_KEY,
  HOT_REWARD_TIERS_KEY,
  HOT_TODAY_SUBMISSIONS_KEY,
  HOT_TODAY_APPROVALS_KEY,
  HOT_TOTAL_APPROVED_KEY,
  metaKey,
} from './cache.keys';
import { CacheTTL } from '../config/cache-ttl.constants';
import { Question } from '../database/entities/question.entity';
import { QuestionStatus } from '../common/enums';
import { AdminConfig } from '../database/entities/admin-config.entity';

@Injectable()
export class HotDataService {
  private readonly logger = new Logger(HotDataService.name);
  private readonly leaderboardTtl: number;
  private readonly metadataTtl: number;
  private readonly realtimeTtl: number;

  constructor(
    private readonly redis: RedisService,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    @InjectRepository(AdminConfig)
    private readonly adminConfigRepo: Repository<AdminConfig>,
  ) {
    this.leaderboardTtl = CacheTTL.LEADERBOARD;
    this.metadataTtl = CacheTTL.METADATA;
    this.realtimeTtl = CacheTTL.ANALYTICS_REALTIME;
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────────

  /**
   * Increment a user's leaderboard score when a question is approved.
   * Call this from the question-approval flow.
   */
  async incrementLeaderboardScore(userId: number, delta = 1): Promise<void> {
    await this.redis.zincrby(LEADERBOARD_KEY, delta, userId.toString());
    await this.redis.expire(LEADERBOARD_KEY, this.leaderboardTtl);
  }

  /** Decrement on question rejection/un-approval (if applicable). */
  async decrementLeaderboardScore(userId: number, delta = 1): Promise<void> {
    const newScore = await this.redis.zincrby(LEADERBOARD_KEY, -delta, userId.toString());
    if (parseFloat(newScore) <= 0) {
      await this.redis.zrem(LEADERBOARD_KEY, userId.toString());
    }
  }

  /** Get top N users from the leaderboard with their scores. */
  async getTopUsers(count = 100): Promise<Array<{ userId: string; score: number }>> {
    const raw = await this.redis.zrevrange(LEADERBOARD_KEY, 0, count - 1);
    const result: Array<{ userId: string; score: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({ userId: raw[i], score: parseFloat(raw[i + 1]) });
    }
    return result;
  }

  // ─── Reward tiers ────────────────────────────────────────────────────────────

  async getRewardTiers(): Promise<unknown> {
    const raw = await this.redis.get(HOT_REWARD_TIERS_KEY);
    if (raw) return JSON.parse(raw);
    // Fallback: load from DB
    const config = await this.adminConfigRepo.findOne({ where: { key: 'reward_tiers' } });
    if (config) {
      await this.redis.set(HOT_REWARD_TIERS_KEY, JSON.stringify(config.value), this.metadataTtl);
      return config.value;
    }
    return null;
  }

  async refreshRewardTiers(): Promise<void> {
    const config = await this.adminConfigRepo.findOne({ where: { key: 'reward_tiers' } });
    if (config) {
      await this.redis.set(HOT_REWARD_TIERS_KEY, JSON.stringify(config.value), this.metadataTtl);
    }
  }

  // ─── Real-time counters ──────────────────────────────────────────────────────

  /** Increment today's submission counter. Call on every question submit. */
  async incrementTodaySubmissions(): Promise<number> {
    const count = await this.redis.incr(HOT_TODAY_SUBMISSIONS_KEY);
    if (count === 1) {
      // First increment today — set TTL to end of day
      const secsUntilMidnight = this.secondsUntilMidnight();
      await this.redis.expire(HOT_TODAY_SUBMISSIONS_KEY, secsUntilMidnight);
    }
    return count;
  }

  /** Increment today's approval counter. Call on every question approval. */
  async incrementTodayApprovals(): Promise<number> {
    const count = await this.redis.incr(HOT_TODAY_APPROVALS_KEY);
    if (count === 1) {
      const secsUntilMidnight = this.secondsUntilMidnight();
      await this.redis.expire(HOT_TODAY_APPROVALS_KEY, secsUntilMidnight);
    }
    return count;
  }

  async getTodaySubmissions(): Promise<number> {
    const raw = await this.redis.get(HOT_TODAY_SUBMISSIONS_KEY);
    return raw ? parseInt(raw, 10) : 0;
  }

  async getTodayApprovals(): Promise<number> {
    const raw = await this.redis.get(HOT_TODAY_APPROVALS_KEY);
    return raw ? parseInt(raw, 10) : 0;
  }

  async getTotalApproved(): Promise<number> {
    const raw = await this.redis.get(HOT_TOTAL_APPROVED_KEY);
    if (raw) return parseInt(raw, 10);
    const count = await this.questionRepo.count({ where: { status: QuestionStatus.APPROVED } });
    await this.redis.set(HOT_TOTAL_APPROVED_KEY, String(count), this.realtimeTtl);
    return count;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private secondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }
}