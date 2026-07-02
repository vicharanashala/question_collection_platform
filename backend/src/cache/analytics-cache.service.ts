import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import {
  analyticsDailyKey,
  analyticsMonthlyKey,
  analyticsRealtimeKey,
} from './cache.keys';
import { CacheTTL } from '../config/cache-ttl.constants';

interface DailyStats {
  date: string;
  submissions: number;
  approvals: number;
  rejections: number;
  signups: number;
}

interface MonthlyStats {
  month: string;
  totalSubmissions: number;
  totalApprovals: number;
  totalRejections: number;
  totalSignups: number;
}

@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);
  private readonly realtimeTtl: number;
  private readonly dailyTtl: number;
  private readonly monthlyTtl: number;

  constructor(
    private readonly redis: RedisService,
  ) {
    this.realtimeTtl = CacheTTL.ANALYTICS_REALTIME;
    this.dailyTtl = CacheTTL.ANALYTICS_DAILY;
    this.monthlyTtl = CacheTTL.ANALYTICS_MONTHLY;
  }

  // ─── Real-time counters ──────────────────────────────────────────────────────

  async incrementRealtime(metric: string, delta = 1): Promise<number> {
    const key = analyticsRealtimeKey(metric);
    const count = await this.redis.incrby(key, delta);
    if (count === delta) {
      // First write — set TTL to expire shortly after midnight
      const secs = this.secondsUntilMidnight() + 120; // 2-min grace
      await this.redis.expire(key, secs);
    }
    return count;
  }

  async getRealtime(metric: string): Promise<number> {
    const raw = await this.redis.get(analyticsRealtimeKey(metric));
    return raw ? parseInt(raw, 10) : 0;
  }

  async setRealtime(metric: string, value: number): Promise<void> {
    await this.redis.set(analyticsRealtimeKey(metric), String(value), this.realtimeTtl);
  }

  // ─── Daily aggregates ────────────────────────────────────────────────────────

  async getDailyStats(date: string): Promise<DailyStats | null> {
    const raw = await this.redis.get(analyticsDailyKey(date));
    return raw ? JSON.parse(raw) : null;
  }

  async setDailyStats(stats: DailyStats): Promise<void> {
    await this.redis.set(analyticsDailyKey(stats.date), JSON.stringify(stats), this.dailyTtl);
  }

  async updateDailyStat(date: string, field: keyof Omit<DailyStats, 'date'>, delta = 1): Promise<void> {
    const key = analyticsDailyKey(date);
    const raw = await this.redis.get(key);
    const stats: DailyStats = raw
      ? JSON.parse(raw)
      : { date, submissions: 0, approvals: 0, rejections: 0, signups: 0 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((stats as unknown as Record<string, number>)[field] ?? 0) + delta;
    stats[field] = (stats[field] ?? 0) + delta;
    await this.redis.set(key, JSON.stringify(stats), this.dailyTtl);
  }

  // ─── Monthly aggregates ──────────────────────────────────────────────────────

  async getMonthlyStats(month: string): Promise<MonthlyStats | null> {
    const raw = await this.redis.get(analyticsMonthlyKey(month));
    return raw ? JSON.parse(raw) : null;
  }

  async setMonthlyStats(stats: MonthlyStats): Promise<void> {
    await this.redis.set(analyticsMonthlyKey(stats.month), JSON.stringify(stats), this.monthlyTtl);
  }

  // ─── Event hooks ─────────────────────────────────────────────────────────────

  /** Increment counters on question submission. Call from submission flow. */
  async onQuestionSubmitted(): Promise<void> {
    const today = this.today();
    await this.updateDailyStat(today, 'submissions', 1);
    await this.incrementRealtime('submissions', 1);
  }

  /** Increment counters on question approval. Call from approval flow. */
  async onQuestionApproved(): Promise<void> {
    const today = this.today();
    await this.updateDailyStat(today, 'approvals', 1);
    await this.incrementRealtime('approvals', 1);
  }

  /** Increment counter on question rejection. Call from rejection flow. */
  async onQuestionRejected(): Promise<void> {
    const today = this.today();
    await this.updateDailyStat(today, 'rejections', 1);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private secondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }
}