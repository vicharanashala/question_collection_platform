import { Controller, Get } from '@nestjs/common';
import { SkipJwtAuth } from '../auth/decorators/skip-jwt-auth.decorator';
import { RedisService } from '../cache/redis.service';

@Controller()
export class HealthController {
  constructor(private readonly redisService: RedisService) {}

  @SkipJwtAuth()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @SkipJwtAuth()
  @Get('health')
  async health() {
    let redisStatus = 'unavailable';
    let redisMemory: Record<string, string> = {};

    try {
      await this.redisService.ping();
      redisStatus = 'connected';
      redisMemory = await this.redisService.infoMemory();
    } catch {
      redisStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      redis: {
        status: redisStatus,
        usedMemory: redisMemory['used_memory_human'] ?? null,
        peakMemory: redisMemory['used_memory_peak_human'] ?? null,
      },
    };
  }
}