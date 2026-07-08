import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from './redis.service';
import { metaKey, HOT_REWARD_TIERS_KEY, LEADERBOARD_KEY } from './cache.keys';
import { CacheTTL } from '../config/cache-ttl.constants';
import { AdminConfig } from '../database/entities/admin-config.entity';
import { Question } from '../database/entities/question.entity';
import { QuestionStatus } from '../common/enums';

@Injectable()
export class CacheWarmupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheWarmupService.name);
  private readonly metadataTtl: number;
  private readonly leaderboardTtl: number;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  // Reconnect warmup — registered on the Redis client
  private reconnectHandler: () => void;

  constructor(
    private readonly redis: RedisService,
    @InjectRepository(AdminConfig)
    private readonly adminConfigRepo: Repository<AdminConfig>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {
    this.metadataTtl = CacheTTL.METADATA;
    this.leaderboardTtl = CacheTTL.LEADERBOARD;

    // Re-run warmup when Redis reconnects (handles Redis restarts)
    this.reconnectHandler = () => {
      this.logger.log('Redis reconnected — re-running cache warmup');
      this.warmAll().catch((err) => this.logger.warn(`Warmup on reconnect failed: ${err.message}`));
    };
  }

  async onModuleInit(): Promise<void> {
    await this.warmAll();

    // Register reconnect handler
    this.redis.onReconnect(this.reconnectHandler);

    // Periodic refresh every 5 minutes
    this.refreshInterval = setInterval(() => {
      if (!this.redis.isBypassed()) {
        this.refreshHotData().catch((err) =>
          this.logger.warn(`Periodic warmup failed: ${err.message}`),
        );
      }
    }, 5 * 60 * 1000);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  async warmAll(): Promise<void> {
    this.logger.log('Cache warmup starting...');
    await Promise.allSettled([
      this.warmMetadata(),
      this.warmLeaderboard(),
      this.warmRewardTiers(),
    ]);
    this.logger.log('Cache warmup complete');
  }

  /** Pre-load admin config metadata into Redis, one key per config entry. */
  private async warmMetadata(): Promise<void> {
    try {
      const configs = await this.adminConfigRepo.find();
      // Store each config under its own key so none overwrite each other.
      // Key format: meta:admin_config:{config.key}
      const pipeline = this.redis.pipeline();
      for (const config of configs) {
        pipeline.set(metaKey(`admin_config:${config.key}`), JSON.stringify(config.value), this.metadataTtl);
      }
      await pipeline.exec();
      this.logger.debug(`CacheWarmup: cached ${configs.length} admin config entries`);
    } catch (err: any) {
      this.logger.warn(`CacheWarmup: failed to warm metadata: ${err.message}`);
    }
  }

  /** Pre-build the Redis sorted set leaderboard from approved question counts. */
  private async warmLeaderboard(): Promise<void> {
    try {
      const results: Array<{ userId: number; approvedCount: number }> = await this.questionRepo
        .createQueryBuilder('q')
        .select('q.user_id', 'userId')
        .addSelect('COUNT(*)', 'approvedCount')
        .where('q.status = :status', { status: QuestionStatus.APPROVED })
        .groupBy('q.user_id')
        .orderBy('COUNT(*)', 'DESC')
        .limit(100)
        .getRawMany();

      // Batch all writes into a single pipeline round-trip.
      const pipeline = this.redis.pipeline();
      pipeline.del(LEADERBOARD_KEY);
      for (const { userId, approvedCount } of results) {
        pipeline.zadd(LEADERBOARD_KEY, approvedCount, userId.toString());
      }
      pipeline.expire(LEADERBOARD_KEY, this.leaderboardTtl);
      await pipeline.exec();

      this.logger.debug(`CacheWarmup: leaderboard seeded with ${results.length} users`);
    } catch (err: any) {
      this.logger.warn(`CacheWarmup: failed to warm leaderboard: ${err.message}`);
    }
  }

  /** Pre-load reward tiers config into hot data cache. */
  private async warmRewardTiers(): Promise<void> {
    try {
      const tiers = await this.adminConfigRepo.findOne({ where: { key: 'reward_tiers' } });
      if (tiers) {
        await this.redis.set(HOT_REWARD_TIERS_KEY, JSON.stringify(tiers.value), this.metadataTtl);
      }
    } catch (err: any) {
      this.logger.warn(`CacheWarmup: failed to warm reward tiers: ${err.message}`);
    }
  }

  /** Called externally when admin updates config — invalidates all metadata cache. */
  async invalidateMetadataCache(): Promise<void> {
    await this.redis.delByPattern('meta:*');
  }

  /**
   * Refresh hot/real-time data on a periodic interval (every 5 min).
   * Skips metadata — only refreshes leaderboard and reward tiers since those
   * are the data most likely to become stale without a full app restart.
   */
  async refreshHotData(): Promise<void> {
    await Promise.allSettled([
      this.warmLeaderboard(),
      this.warmRewardTiers(),
    ]);
  }
}