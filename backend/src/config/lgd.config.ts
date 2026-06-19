import { registerAs } from '@nestjs/config';

export const lgdConfig = registerAs('lgd', () => ({
  apiKey: process.env.LGD_API_KEY || '',
  statesUrl: process.env.LGD_STATES_API_URL || 'https://api.data.gov.in/resource/a71e60f0-a21d-43de-a6c5-fa5d21600cdb',
  districtsUrl: process.env.LGD_DISTRICTS_API_URL || 'https://api.data.gov.in/resource/37231365-78ba-44d5-ac22-3deec40b9197',
  subdistrictsUrl: process.env.LGD_SUBDISTRICTS_API_URL || 'https://api.data.gov.in/resource/6be51a29-876a-403a-a6da-42fde795e751',
  // Cache TTL in seconds
  cacheTtlSec: parseInt(process.env.LGD_CACHE_TTL_SEC || String(7 * 24 * 60 * 60), 10), // 7 days
  // Page size when fetching from LGD
  pageSize: parseInt(process.env.LGD_PAGE_SIZE || '1000', 10),
}));