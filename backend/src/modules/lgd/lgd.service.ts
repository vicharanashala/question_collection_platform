import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

interface CachedData<T> {
  data: T;
  fetchedAt: number;
}

interface LgdRecord {
  [key: string]: string | number;
}

@Injectable()
export class LgdService {
  private readonly logger = new Logger(LgdService.name);
  private readonly apiKey: string;
  private readonly statesUrl: string;
  private readonly districtsUrl: string;
  private readonly subdistrictsUrl: string;
  private readonly villagesUrl: string;
  private readonly cacheTtlMs: number;
  private readonly reviewerUri: string;
  // In-memory caches
  private readonly statesCache = new Map<string, CachedData<LgdRecord[]>>();
  private readonly districtsCache = new Map<string, CachedData<LgdRecord[]>>();
  private readonly subdistrictsCache = new Map<string, CachedData<LgdRecord[]>>();
  private readonly villagesCache = new Map<string, CachedData<LgdRecord[]>>();

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LGD_API_KEY') ?? '';
    this.statesUrl = this.configService.get<string>('LGD_STATES_API_URL') ?? '';
    this.districtsUrl = this.configService.get<string>('LGD_DISTRICTS_API_URL') ?? '';
    this.subdistrictsUrl = this.configService.get<string>('LGD_SUBDISTRICTS_API_URL') ?? '';
    this.villagesUrl = this.configService.get<string>('LGD_VILLAGES_API_URL') ?? '';
    this.cacheTtlMs = (this.configService.get<number>('LGD_CACHE_TTL_DAYS') ?? 7) * 86_400_000;
    this.logger.log(`LGD API configured — cache TTL: ${this.cacheTtlMs / 86_400_000}d`);
    this.reviewerUri = this.configService.get<string>('REVIEWER_URI') ?? '';
  }

  /**
   * Make a single LGD API request with optional server-side filters.
   * Uses filters[key]=value params so data.gov.in returns only matching records.
   */
  private async makeLGDRequest(
    apiUrl: string,
    filters?: Record<string, string | number>,
  ): Promise<LgdRecord[]> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('LGD_API_KEY is not configured');
    }

    const params: Record<string, string | number> = {
      'api-key': this.apiKey,
      format: 'json',
      limit: 10_000,
      offset: 0,
    };

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        params[`filters[${key}]`] = value;
      }
    }

    try {
      const response = await axios.get(apiUrl, { params, timeout: 30_000 });

      if (!response?.data?.records) {
        throw new InternalServerErrorException('Invalid LGD API response: records missing');
      }

      return response.data.records;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;

      const axiosErr = err as AxiosError<{ message?: string }>;
      const message =
        axiosErr?.response?.data?.message ??
        axiosErr?.message ??
        'Failed to fetch LGD locations';

      throw new InternalServerErrorException(`LGD service error: ${message}`);
    }
  }

  private async fetchAndTransform<T, R>(
  url: string,
  sortKey: keyof T,
  mapper: (item: T) => R,
): Promise<R[]> {
  const response = await axios.get<T[]>(url);

  return response.data
    .sort((a, b) =>
      String(a[sortKey]).localeCompare(String(b[sortKey]))
    )
    .map(mapper);
}

  /** Returns all villages for a given subdistrict (block) code, sorted by name */
  async getVillages(subdistrictCode: string): Promise<LgdRecord[]> {
    const cached = this.villagesCache.get(subdistrictCode);
    if (this.isValid(cached)) {
      return cached!.data;
    }

    // Use server-side filter so the API returns only villages for this subdistrict
    // Villages API uses camelCase for both filter keys and response fields
    // const records = await this.makeLGDRequest(this.villagesUrl, {
    //   subdistrictCode,
    // });

    // No normalization needed — villages API already uses camelCase keys

  const sorted = await this.fetchAndTransform<
  {
    villageCode: number;
    villageNameEnglish: string;
    blockCode: number;
    pincode: string;
  },
  LgdRecord
>(
  `${this.reviewerUri}/location/villages?blockCode=${subdistrictCode}`,
  "villageNameEnglish",
  (village) => ({
    villageCode: village.villageCode,
    villageNameEnglish: village.villageNameEnglish,
    subdistrictCode: village.blockCode,
    pincode: village.pincode,
  }),
);

    this.villagesCache.set(subdistrictCode, { data: sorted, fetchedAt: Date.now() });
    this.logger.log(`LGD: cached ${sorted.length} villages for subdistrict ${subdistrictCode}`);
    return sorted;
  }

  /** Returns all Indian states, sorted by name */
  async getStates(): Promise<LgdRecord[]> {
    const cached = this.statesCache.get('all');
    if (this.isValid(cached)) {
      return cached!.data;
    }



const sorted = await this.fetchAndTransform<
  { stateCode: number; stateNameEnglish: string },
  LgdRecord
>(
  `${this.reviewerUri}/location/states`,
  "stateNameEnglish",
  (state) => ({
    state_code: state.stateCode,
    state_name_english: state.stateNameEnglish,
  }),
);

    this.statesCache.set('all', { data: sorted, fetchedAt: Date.now() });
    this.logger.log(`LGD: cached ${sorted.length} states`);
    return sorted;
  }

  

  /** Returns all districts for a given state code, sorted by name */
  async getDistricts(stateCode: string): Promise<LgdRecord[]> {
    const cached = this.districtsCache.get(stateCode);
    if (this.isValid(cached)) {
      return cached!.data;
    }
    // Districts API uses snake_case filter keys and response fields
    // const records = await this.makeLGDRequest(this.districtsUrl, { state_code: stateCode });

  const sorted = await this.fetchAndTransform<
  {
    districtCode: number;
    districtNameEnglish: string;
    stateCode: number;
  },
  LgdRecord
>(
  `${this.reviewerUri}/location/districts?stateCode=${stateCode}`,
  "districtNameEnglish",
  (district) => ({
    district_code: district.districtCode,
    district_name_english: district.districtNameEnglish,
    state_code: district.stateCode,
  }),
);
    this.districtsCache.set(stateCode, { data: sorted, fetchedAt: Date.now() });
    this.logger.log(`LGD: cached ${sorted.length} districts for state ${stateCode}`);
    return sorted;
  }

  /** Returns all sub-districts (blocks) for a given district code, sorted by name */
  async getSubDistricts(districtCode: string): Promise<LgdRecord[]> {
    const cached = this.subdistrictsCache.get(districtCode);
    if (this.isValid(cached)) {
      return cached!.data;
    }

    // Subdistricts API uses snake_case filter keys and response fields
    // const records = await this.makeLGDRequest(this.subdistrictsUrl, { district_code: districtCode });



  const sorted = await this.fetchAndTransform<
  {
    blockCode: number;
    blockNameEnglish: string;
    districtCode: number;
  },
  LgdRecord
>(
  `${this.reviewerUri}/location/blocks?districtCode=${districtCode}`,
  "blockNameEnglish",
  (block) => ({
    subdistrict_code: block.blockCode,
    subdistrict_name_english: block.blockNameEnglish,
    district_code: block.districtCode,
  }),
);

    this.subdistrictsCache.set(districtCode, { data: sorted, fetchedAt: Date.now() });
    this.logger.log(`LGD: cached ${sorted.length} sub-districts for district ${districtCode}`);
    return sorted;
  }

  private isValid<T>(cached: CachedData<T> | undefined): boolean {
    if (!cached) return false;
    return Date.now() - cached.fetchedAt < this.cacheTtlMs;
  }

  /**
   * Convert camelCase keys to snake_case.
   * Needed because the villages API returns camelCase while all other LGD
   * APIs return snake_case field names.
   */
  private normalizeKeys(record: LgdRecord): LgdRecord {
    const normalized: LgdRecord = {};
    for (const [k, v] of Object.entries(record)) {
      const snakeKey = k.replace(/([A-Z])/g, (_, c) => `_${c.toLowerCase()}`);
      normalized[snakeKey] = v;
    }
    return normalized;
  }
}