import { mongoIn } from "../../../shared/database/abstractions/mongo-utils";
import { Injectable, NotFoundException, BadRequestException, OnModuleInit, Inject } from "@nestjs/common";
import { AdminConfig } from "../../../shared/database/entities";
import { UpdateConfigDto, CreateConfigDto } from "../dto";
import { IAdminConfigRepository } from "../../../shared/database/repositories";
import { REPOSITORY_TOKENS } from "../../../shared/database/repositories";

// Config key constants — mirrors database.md defaults
const DEFAULT_CONFIG: Record<string, { value: number; description: string }> = {
  max_users_per_state: {
    value: 100,
    description: "Maximum registered users per state",
  },
  min_withdrawal_amount: {
    value: 50,
    description: "Minimum withdrawal threshold (INR)",
  },

  daily_question_limit: {
    value: 20,
    description: "Max questions per user per day",
  },
  video_max_duration_seconds: {
    value: 10,
    description: "Maximum video duration (seconds)",
  },
  video_max_size_mb: { value: 10, description: "Maximum video file size (MB)" },
  max_question_chars: {
    value: 1000,
    description: "Maximum characters allowed in a question",
  },
  // 0 = disabled, 1 = enabled. Withdrawals stay off until the payment integration
  // is signed off; flipping this is an admin action.
  payment_withdrawal_enabled: {
    value: 0,
    description: "Enable wallet withdrawals",
  },
  // 0 = disabled, 1 = enabled. Independent from payment_withdrawal_enabled —
  // gates adding a new UPI/bank payment method and its verification, so the
  // two can be turned on/off separately (e.g. let users verify a payout
  // method before withdrawals themselves go live).
  payment_verification_enabled: {
    value: 0,
    description: "Enable adding and verifying payment methods",
  },
};

// Admin configuration values: cached reads for the rest of the app plus the config endpoints.
@Injectable()
export class AdminConfigService implements OnModuleInit {
  // In-memory TTL cache for config values (30-second cache)
  private configCache: Map<string, number> = new Map();
  private configCacheExpiry = 0;
  private static readonly CONFIG_CACHE_TTL_MS = 30_000;

  constructor(
    @Inject(REPOSITORY_TOKENS.AdminConfig)
    private readonly configRepo: IAdminConfigRepository,
  ) {}

  async onModuleInit() {
    // Pre-populate cache on startup so first requests aren't cache-miss latency
    await this.refreshConfigCache();
  }

  private async refreshConfigCache(): Promise<void> {
    const rows = await this.configRepo.find();
    this.configCache.clear();
    for (const row of rows) {
      this.configCache.set(row.key, row.value as number);
    }
    this.configCacheExpiry = Date.now() + AdminConfigService.CONFIG_CACHE_TTL_MS;
  }

  private async getCachedConfigValue(key: string): Promise<number> {
    // TEMPORARY RESTRICTION
    const isPaymentModifiable = false;
    if (
      !isPaymentModifiable &&
      (key === "payment_withdrawal_enabled" ||
        key === "payment_verification_enabled")
    ) {
      return 0;
    }

    if (Date.now() > this.configCacheExpiry) {
      await this.refreshConfigCache();
    }
    if (this.configCache.has(key)) {
      return this.configCache.get(key)!;
    }
    // Fallback to DB for keys that may not be seeded
    const row = await this.configRepo.findOne({ key });
    const value = row
      ? (row.value as number)
      : (DEFAULT_CONFIG[key]?.value ?? 0);
    this.configCache.set(key, value);
    return value;
  }

  /**
   * Bulk-fetch multiple config values in a single DB call (uses cache).
   * Returns a plain object of key → value for the requested keys.
   */
  async getConfigValues(keys: string[]): Promise<Record<string, number>> {
    if (Date.now() > this.configCacheExpiry) {
      await this.refreshConfigCache();
    }
    const result: Record<string, number> = {};
    const missing: string[] = [];
    for (const key of keys) {
      if (this.configCache.has(key)) {
        result[key] = this.configCache.get(key)!;
      } else {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      const rows = await this.configRepo.find({ key: mongoIn(missing) });
      for (const row of rows) {
        this.configCache.set(row.key, row.value as number);
        result[row.key] = row.value as number;
      }
      // Fill missing with defaults
      for (const k of missing) {
        if (result[k] === undefined) {
          const def = DEFAULT_CONFIG[k]?.value ?? 0;
          this.configCache.set(k, def);
          result[k] = def;
        }
      }
    }

    // TEMPORARY RESTRICTION
    const isPaymentModifiable = false;
    if (!isPaymentModifiable) {
      if (keys.includes("payment_withdrawal_enabled"))
        result["payment_withdrawal_enabled"] = 0;
      if (keys.includes("payment_verification_enabled"))
        result["payment_verification_enabled"] = 0;
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Section 3: Configuration Management
  // ─────────────────────────────────────────────────────────────

  async listConfig() {
    // Seed defaults that don't exist yet
    for (const [key, cfg] of Object.entries(DEFAULT_CONFIG)) {
      const existing = await this.configRepo.findOne({ key });
      if (!existing) {
        await this.configRepo.save({
          key,
          value: cfg.value,
          description: cfg.description,
        });
      }
    }

    const configs = await this.configRepo.findAll({}, { pagination: { sort: { key: 1 } } });
    // TEMPORARY RESTRICTION
    const isPaymentModifiable = false;

    return {
      items: configs.map((c) => {
        if (
          !isPaymentModifiable &&
          (c.key === "payment_withdrawal_enabled" ||
            c.key === "payment_verification_enabled")
        ) {
          return {
            key: c.key,
            value: 0,
            description: c.description,
          };
        }
        return {
          key: c.key,
          value: c.value,
          description: c.description,
        };
      }),
    };
  }

  async updateConfig(adminId: string, dto: UpdateConfigDto) {
    // TEMPORARY RESTRICTION: Block enabling/disabling payment features
    const isPaymentModifiable = false;
    if (
      !isPaymentModifiable &&
      (dto.key === "payment_withdrawal_enabled" ||
        dto.key === "payment_verification_enabled")
    ) {
      throw new BadRequestException(
        "Payment features cannot be enabled or disabled at the moment. Kindly contact the development team.",
      );
    }

    const config = await this.configRepo.findOne({ key: dto.key });
    if (!config)
      throw new NotFoundException(`Config key '${dto.key}' not found`);

    const oldValue = config.value;

    await this.configRepo.updateMany(
      { key: dto.key },
      {
        value: dto.value,
        description: dto.description ?? config.description,
        updatedBy: adminId,
      },
    );

    // Invalidate cache so next read gets the new value
    this.configCache.delete(dto.key);

    return { success: true, key: dto.key, oldValue, newValue: dto.value };
  }

  async createConfig(adminId: string, dto: CreateConfigDto) {
    const existing = await this.configRepo.findOne({ key: dto.key });
    if (existing)
      throw new BadRequestException(`Config key '${dto.key}' already exists`);

    const saved = await this.configRepo.save({
      key: dto.key,
      value: dto.value,
      description: dto.description,
      updatedBy: adminId,
    });

    // Populate cache for the new key
    this.configCache.set(dto.key, dto.value);

    return {
      success: true,
      config: {
        key: saved.key,
        value: saved.value,
        description: saved.description,
      },
    };
  }

  // Get a single config value (with fallback to default) — uses in-memory cache
  async getConfigValue(key: string): Promise<number> {
    return this.getCachedConfigValue(key);
  }
}
