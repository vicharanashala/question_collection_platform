import { registerAs } from '@nestjs/config';

export const lgdConfig = registerAs('lgd', () => ({
  lgdReviewerUri: process.env.REVIEWER_URI || '',
  cacheTtlDays: parseInt(process.env.LGD_CACHE_TTL_DAYS || '7', 10),
  maxRetries: parseInt(process.env.LGD_MAX_RETRIES || '3', 10),
  initialBackoffMs: parseInt(process.env.LGD_INITIAL_BACKOFF_MS || '500', 10),
}));