import { Injectable, Logger, ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseStringPromise } from 'xml2js';

interface CachedData<T> {
  data: T;
  fetchedAt: number;
}

interface LgdRecord {
  [key: string]: string;
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
  private readonly pageSize = 1000;

  // In-memory caches (Keyed by state code / district code)
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
  }

  /** Returns all villages for a given subdistrict (block) code, sorted by name */
  async getVillages(subdistrictCode: string): Promise<LgdRecord[]> {
    const cached = this.villagesCache.get(subdistrictCode);
    if (this.isValid(cached)) {
      return cached!.data;
    }

    // LGD API ignores the subdistrict_code filter server-side, so fetch all and filter client-side
    const allRecords = await this.fetchAllPages(this.villagesUrl, {});
    const filtered = allRecords.filter(
      (r) => String(r['subdistrict_code'] ?? '').trim() === subdistrictCode,
    );
    const sorted = filtered.sort((a, b) =>
      (a['village_name_english'] ?? '').localeCompare(b['village_name_english'] ?? ''),
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

    const records = await this.fetchAllPages(this.statesUrl, {});
    const sorted = records.sort((a, b) =>
      (a['state_name_english'] ?? '').localeCompare(b['state_name_english'] ?? ''),
    );
    this.statesCache.set('all', { data: sorted, fetchedAt: Date.now() });
    this.logger.log(`LGD: cached ${sorted.length} states`);
    return sorted;
  }

  /** Returns all districts for a given state_code, sorted by name */
  async getDistricts(stateCode: string): Promise<LgdRecord[]> {
    const cached = this.districtsCache.get(stateCode);
    if (this.isValid(cached)) {
      return cached!.data;
    }

    // LGD API ignores the state_code filter server-side, so fetch all and filter client-side
    const allRecords = await this.fetchAllPages(this.districtsUrl, {});
    const filtered = allRecords.filter(
      (r) => String(r['state_code'] ?? '').trim() === stateCode,
    );
    const sorted = filtered.sort((a, b) =>
      (a['district_name_english'] ?? '').localeCompare(b['district_name_english'] ?? ''),
    );
    this.districtsCache.set(stateCode, { data: sorted, fetchedAt: Date.now() });
    this.logger.log(`LGD: cached ${sorted.length} districts for state ${stateCode}`);
    return sorted;
  }

  /** Returns all sub-districts (blocks) for a given district_code, sorted by name */
  async getSubDistricts(districtCode: string): Promise<LgdRecord[]> {
    const cached = this.subdistrictsCache.get(districtCode);
    if (this.isValid(cached)) {
      return cached!.data;
    }

    // LGD API ignores the subdistrict_code filter server-side, so fetch all and filter client-side
    const allRecords = await this.fetchAllPages(this.subdistrictsUrl, {});
    const filtered = allRecords.filter(
      (r) => String(r['district_code'] ?? '').trim() === districtCode,
    );
    const sorted = filtered.sort((a, b) =>
      (a['subdistrict_name_english'] ?? '').localeCompare(b['subdistrict_name_english'] ?? ''),
    );
    this.subdistrictsCache.set(districtCode, { data: sorted, fetchedAt: Date.now() });
    this.logger.log(`LGD: cached ${sorted.length} sub-districts for district ${districtCode}`);
    return sorted;
  }

  private isValid<T>(cached: CachedData<T> | undefined): boolean {
    if (!cached) return false;
    return Date.now() - cached.fetchedAt < this.cacheTtlMs;
  }

  private async fetchAllPages(url: string, filters: Record<string, string>): Promise<LgdRecord[]> {
    const records: LgdRecord[] = [];
    let offset = 0;
    while (true) {
      const page = await this.fetchPage(url, filters, offset);
      records.push(...page.records);
      if (records.length >= page.total) break;
      offset += this.pageSize;
    }
    return records;
  }

  private async fetchPage(
    url: string,
    filters: Record<string, string>,
    offset: number,
  ): Promise<{ records: LgdRecord[]; total: number }> {
    const params = new URLSearchParams({
      'api-key': this.apiKey,
      limit: String(this.pageSize),
      offset: String(offset),
      format: 'json',
      ...filters,
    });

    const fullUrl = `${url}?${params.toString()}`;
    const text = await this.httpGet(fullUrl);
    let parsed: any;
    try {
      // LGD returns JSON by default (format=json param is set above)
      parsed = JSON.parse(text);
    } catch {
      // Fall back to XML if the API ignores the format param
      parsed = await parseStringPromise(text, { explicitArray: false, trim: true });
    }

    // JSON: top-level { records, total, ... }  |  XML: { result: { records, total, ... } }
    const result = parsed?.result ?? parsed;
    if (!result) {
      this.logger.warn(`LGD: unexpected response from ${url}`, text.slice(0, 200));
      return { records: [], total: 0 };
    }

    const rawRecords = result.records;
    let records: LgdRecord[] = [];
    if (Array.isArray(rawRecords)) {
      records = rawRecords;
    } else if (rawRecords) {
      records = [rawRecords];
    }

    return {
      records,
      total: parseInt(result.total ?? '0', 10),
    };
  }

  private httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const mod = url.startsWith('https') ? require('https') : require('http');
      const u = new URL(url);
      const opts = {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'GET',
        headers: { 'User-Agent': 'question-collection-platform/1.0' },
        timeout: 15_000,
      };
      const req = mod.request(opts, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.on('timeout', () => reject(new Error(`LGD request timed out: ${url}`)));
      req.end();
    });
  }
}