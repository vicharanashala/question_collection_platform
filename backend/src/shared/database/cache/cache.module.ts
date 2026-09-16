import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisService } from './redis.service';
import { RateLimitCounterService } from './rate-limit-counter.service';
import { RateLimitCounterSchema } from '../mongodb/schemas/rate-limit-counter.schema';
import { SessionService } from './session.service';
import { CacheWarmupService } from './cache-warmup.service';
import { QueryCacheService } from './query-cache.service';
import { HotDataService } from './hot-data.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { getRateLimitPresets } from './rate-limit-presets';
import { DbModule } from '../db.module';

@Global()
@Module({
  imports: [
    DbModule,
    ConfigModule,
    // Backing store for rate limiting when Redis is disabled.
    MongooseModule.forFeature([
      { name: 'RateLimitCounter', schema: RateLimitCounterSchema },
    ]),
  ],
  providers: [
    RedisService,
    RateLimitCounterService,
    SessionService,
    CacheWarmupService,
    QueryCacheService,
    HotDataService,
    AnalyticsCacheService,
    DuplicateDetectionService,
    CacheInterceptor,
    RateLimitGuard,
    // Pre-configured rate limit presets wired to ConfigService env vars.
    // Controllers inject this via @Inject('RATE_LIMIT_PRESETS') to use in decorators.
    {
      provide: 'RATE_LIMIT_PRESETS',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => getRateLimitPresets(configService),
    },
  ],
  exports: [
    RedisService,
    RateLimitCounterService,
    SessionService,
    CacheWarmupService,
    QueryCacheService,
    HotDataService,
    AnalyticsCacheService,
    DuplicateDetectionService,
    CacheInterceptor,
    RateLimitGuard,
    'RATE_LIMIT_PRESETS',
  ],
})
export class CacheModule {}