import { registerAs } from '@nestjs/config';

export const lgdConfig = registerAs('lgd', () => ({
  lgdReviewerUri: process.env.REVIEWER_URI || '',
  cacheTtlDays: parseInt(process.env.LGD_CACHE_TTL_DAYS || '7', 10),
}));