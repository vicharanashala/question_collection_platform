import { Module, Global, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from './redis.service';
import { SessionService } from './session.service';
import { CacheWarmupService } from './cache-warmup.service';
import { QueryCacheService } from './query-cache.service';
import { HotDataService } from './hot-data.service';
import { AnalyticsCacheService } from './analytics-cache.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { AdminConfig } from '../database/entities/admin-config.entity';
import { User } from '../database/entities/user.entity';
import { Question } from '../database/entities/question.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AdminConfig, User, Question])],
  providers: [
    RedisService,
    SessionService,
    CacheWarmupService,
    QueryCacheService,
    HotDataService,
    AnalyticsCacheService,
    DuplicateDetectionService,
    CacheInterceptor,
    RateLimitGuard,
  ],
  exports: [
    RedisService,
    SessionService,
    CacheWarmupService,
    QueryCacheService,
    HotDataService,
    AnalyticsCacheService,
    DuplicateDetectionService,
    CacheInterceptor,
    RateLimitGuard,
  ],
})
export class CacheModule {}