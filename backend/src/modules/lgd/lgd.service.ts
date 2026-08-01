import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface CachedData<T> {
  data: T;
  fetchedAt: number;
}

// Raw shapes returned by the reviewer service
interface ReviewerState {
  stateCode: number;
  stateNameEnglish: string;
}

interface ReviewerDistrict {
  districtCode: number;
  districtNameEnglish: string;
  stateCode: number;
}

interface ReviewerBlock {
  blockCode: number;
  blockNameEnglish: string;
  districtCode: number;
}

interface ReviewerVillage {
  villageCode: number;
  villageNameEnglish: string;
  blockCode: number;
  pincode: string;
}

interface ReviewerKvk {
  kvkId: string;
  kvkName: string;
  kvkAddress: string;
  districtCode: number;
  stateCode: number;
  latitude: number;
  longitude: number;
}

// Canonical snake_case shapes used internally and returned to callers
export interface LgdState {
  state_code: string;
  state_name_english: string;
}

export interface LgdDistrict {
  district_code: string;
  district_name_english: string;
  state_code: string;
}

export interface LgdSubDistrict {
  subdistrict_code: string;
  subdistrict_name_english: string;
  district_code: string;
}

export interface LgdVillage {
  villageCode: string;
  villageNameEnglish: string;
  subdistrictCode: string;
  pincode: string;
}

export interface LgdKvk {
  kvkCode: string;
  kvkName: string;
  kvkAddress: string;
  districtCode: string;
  stateCode: string;
  latitude: number;
  longitude: number;
}

@Injectable()
export class LgdService {
  private readonly logger = new Logger(LgdService.name);

  /** Base URL of the reviewer (LGD facade) service */
  private readonly reviewerUri: string;

  /** Cache TTL in milliseconds, read from config */
  private readonly cacheTtlMs: number;

  /** Per-endpoint in-memory caches */
  private readonly statesCache = new Map<string, CachedData<LgdState[]>>();
  private readonly districtsCache = new Map<string, CachedData<LgdDistrict[]>>();
  private readonly subdistrictsCache = new Map<string, CachedData<LgdSubDistrict[]>>();
  private readonly villagesCache = new Map<string, CachedData<LgdVillage[]>>();
  private readonly kvksCache = new Map<string, CachedData<LgdKvk[]>>();

  constructor(private readonly configService: ConfigService) {
    // NestJS ConfigService namespaced under 'lgd' (from registerAs('lgd', …)),
    // with raw env as fallback when the config isn't loaded yet.
    this.reviewerUri =
      this.configService.get<string>('lgd.lgdReviewerUri') ||
      process.env.REVIEWER_URI ||
      '';

    const ttlDays =
      this.configService.get<number>('lgd.cacheTtlDays') ??
      parseInt(process.env.LGD_CACHE_TTL_DAYS || '7', 10);
    this.cacheTtlMs = ttlDays * 86_400_000;

    this.logger.log(
      `LGD service initialised — reviewer: ${this.reviewerUri || '(not set)'}, cache TTL: ${ttlDays}d`,
    );
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Fetch a JSON array from the reviewer service, apply a transform, sort by
   * the given key, cache the result, and return it.
   *
   * @param url     Full URL to GET
   * @param cache   Map used for memoisation
   * @param cacheKey  Key into the cache Map (e.g. state code or 'all')
   * @param sortOn  Property name to sort by (locale-insensitive string sort)
   * @param transform  Mapper from raw reviewer shape to public shape
   */
  private async fetchThenCache<T, R>(
    url: string,
    cache: Map<string, CachedData<R[]>>,
    cacheKey: string,
    sortOn: keyof T,
    transform: (item: T) => R,
  ): Promise<R[]> {
    const cached = cache.get(cacheKey);
    if (this.isValid(cached)) {
      return cached!.data;
    }

    const response = await axios.get<T[]>(url, { timeout: 15_000 });

    if (!Array.isArray(response.data)) {
      throw new InternalServerErrorException(
        `LGD reviewer returned unexpected payload for ${url}`,
      );
    }

    const sorted: R[] = [...response.data]
      .sort((a, b) =>
        String(a[sortOn]).localeCompare(String(b[sortOn])),
      )
      .map(transform);

    cache.set(cacheKey, { data: sorted, fetchedAt: Date.now() });
    this.logger.log(
      `LGD cached ${sorted.length} records for key "${cacheKey}" (${url})`,
    );

    return sorted;
  }

  private isValid<T>(cached: CachedData<T> | undefined): boolean {
    return cached !== undefined && Date.now() - cached.fetchedAt < this.cacheTtlMs;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** GET /lgd/states */
  async getStates(): Promise<LgdState[]> {
    if (!this.reviewerUri) {
      throw new InternalServerErrorException('LGD_REVIEWER_URI is not configured');
    }
    return this.fetchThenCache<ReviewerState, LgdState>(
      `${this.reviewerUri}/location/states`,
      this.statesCache,
      'all',
      'stateNameEnglish',
      (s) => ({
        state_code: String(s.stateCode),
        state_name_english: s.stateNameEnglish,
      }),
    );
  }

  /** GET /lgd/districts?stateCode=… */
  async getDistricts(stateCode: string): Promise<LgdDistrict[]> {
    if (!this.reviewerUri) {
      throw new InternalServerErrorException('LGD_REVIEWER_URI is not configured');
    }
    return this.fetchThenCache<ReviewerDistrict, LgdDistrict>(
      `${this.reviewerUri}/location/districts?stateCode=${stateCode}`,
      this.districtsCache,
      stateCode,
      'districtNameEnglish',
      (d) => ({
        district_code: String(d.districtCode),
        district_name_english: d.districtNameEnglish,
        state_code: String(d.stateCode),
      }),
    );
  }

  /** GET /lgd/subdistricts?districtCode=… */
  async getSubDistricts(districtCode: string): Promise<LgdSubDistrict[]> {
    if (!this.reviewerUri) {
      throw new InternalServerErrorException('LGD_REVIEWER_URI is not configured');
    }
    return this.fetchThenCache<ReviewerBlock, LgdSubDistrict>(
      `${this.reviewerUri}/location/blocks?districtCode=${districtCode}`,
      this.subdistrictsCache,
      districtCode,
      'blockNameEnglish',
      (b) => ({
        subdistrict_code: String(b.blockCode),
        subdistrict_name_english: b.blockNameEnglish,
        district_code: String(b.districtCode),
      }),
    );
  }

  /** GET /lgd/villages?blockCode=… */
  async getVillages(blockCode: string): Promise<LgdVillage[]> {
    if (!this.reviewerUri) {
      throw new InternalServerErrorException('LGD_REVIEWER_URI is not configured');
    }
    return this.fetchThenCache<ReviewerVillage, LgdVillage>(
      `${this.reviewerUri}/location/villages?blockCode=${blockCode}`,
      this.villagesCache,
      blockCode,
      'villageNameEnglish',
      (v) => ({
        villageCode: String(v.villageCode),
        villageNameEnglish: v.villageNameEnglish,
        subdistrictCode: String(v.blockCode),
        pincode: v.pincode,
      }),
    );
  }

  /** GET /lgd/kvks?districtCode=… */
  async getKvks(districtCode: string): Promise<LgdKvk[]> {
    if (!this.reviewerUri) {
      throw new InternalServerErrorException('LGD_REVIEWER_URI is not configured');
    }
    return this.fetchThenCache<ReviewerKvk, LgdKvk>(
      `${this.reviewerUri}/location/kvks?districtCode=${districtCode}`,
      this.kvksCache,
      districtCode,
      'kvkName',
      (k) => ({
        kvkCode: k.kvkId,
        kvkName: k.kvkName,
        kvkAddress: k.kvkAddress,
        districtCode: String(k.districtCode),
        stateCode: String(k.stateCode),
        latitude: k.latitude,
        longitude: k.longitude,
      }),
    );
  }

  /** Invalidate all caches. Useful for admin tooling or cache-warming cron jobs. */
  clearCache(): void {
    this.statesCache.clear();
    this.districtsCache.clear();
    this.subdistrictsCache.clear();
    this.villagesCache.clear();
    this.kvksCache.clear();
    this.logger.log('LGD cache cleared');
  }
}