import { Controller, Get } from '@nestjs/common';
import { SkipJwtAuth } from '../auth/decorators/skip-jwt-auth.decorator';
import { RedisService } from '../../shared/database/cache/redis.service';
import { ALL_PATTERNS, KeyPrefix } from '../../shared/database/cache/cache.keys';

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
    const redisEnabled = this.redisService.isEnabled();

    if (!redisEnabled) {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        redis: {
          status: 'disabled',
          enabled: false,
        },
      };
    }

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
        enabled: true,
        usedMemory: redisMemory['used_memory_human'] ?? null,
        peakMemory: redisMemory['used_memory_peak_human'] ?? null,
      },
    };
  }

  @SkipJwtAuth()
  @Get('health/cache')
  async cacheStats() {
    if (!this.redisService.isEnabled()) {
      return {
        timestamp: new Date().toISOString(),
        enabled: false,
        message: 'Redis is disabled (REDIS_ENABLED=false)',
      };
    }

    const circuit = this.redisService.getCircuitState();
    const info: Record<string, string> = (await this.redisService.infoMemory().catch(() => ({}))) as Record<string, string>;
    const dbsize = await this.redisService.dbsize().catch(() => -1);

    // Count keys per prefix by scanning (limited to 1000 per prefix for observability)
    const prefixCounts: Record<string, number> = {};
    for (const [prefix, pattern] of Object.entries(ALL_PATTERNS)) {
      const keys = await this.redisService.scan(pattern, 100, 1000);
      prefixCounts[prefix] = keys.length;
    }

    return {
      timestamp: new Date().toISOString(),
      circuit: {
        open: circuit.open,
        failures: circuit.failures,
        bypassed: this.redisService.isBypassed(),
        since: circuit.since ? new Date(circuit.since).toISOString() : null,
      },
      memory: {
        used: info['used_memory_human'] ?? null,
        peak: info['used_memory_peak_human'] ?? null,
        max: info['maxmemory_human'] ?? null,
      },
      totalKeys: dbsize,
      keysByPrefix: prefixCounts,
    };
  }
}