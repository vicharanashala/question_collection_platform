import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from './redis.service';
import { metaKey, HOT_REWARD_TIERS_KEY, LEADERBOARD_KEY } from './cache.keys';
import { CacheTTL } from '../config/cache-ttl.constants';
import { AdminConfig } from '../database/entities/admin-config.entity';
import { User } from '../database/entities/user.entity';
import { Question } from '../database/entities/question.entity';
import { QuestionStatus } from '../common/enums';

@Injectable()
export class CacheWarmupService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmupService.name);
  private readonly metadataTtl: number;
  private readonly leaderboardTtl: number;

  constructor(
    private readonly redis: RedisService,
    @InjectRepository(AdminConfig)
    private readonly adminConfigRepo: Repository<AdminConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {
    this.metadataTtl = CacheTTL.METADATA;
    this.leaderboardTtl = CacheTTL.LEADERBOARD;
  }

  async onModuleInit(): Promise<void> {
    // Only warm up when Redis is live (skip in-memory dev mode)
    if (!this.redis.isLive()) {
      this.logger.log('CacheWarmupService: using in-memory store, skipping warmup');
      return;
    }
    await this.warmAll();
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

  /** Pre-load admin config metadata into Redis. */
  private async warmMetadata(): Promise<void> {
    try {
      const configs = await this.adminConfigRepo.find();
      for (const config of configs) {
        await this.redis.set(metaKey('admin_config'), JSON.stringify(config), this.metadataTtl);
      }
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

      // Clear and rebuild
      await this.redis.del(LEADERBOARD_KEY);
      for (const { userId, approvedCount } of results) {
        await this.redis.zadd(LEADERBOARD_KEY, approvedCount, userId.toString());
      }
      await this.redis.expire(LEADERBOARD_KEY, this.leaderboardTtl);
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
}