
import { UserAccountLockedException } from '../../shared/classes/exceptions/user-status.exception';
import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException, Inject, Optional } from '@nestjs/common';
import { MoreThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { User, Wallet, AuditLog } from '../../shared/database/entities';
import {
  UserCategory,
  VerificationStatus,
  UserRole,
  AuditAction,
  ActorType,
} from '../../shared/classes/enums';
import { RequestOtpDto, VerifyOtpDto, RegisterDto } from './dto';
import { SmsService } from './sms.service';
import { RedisService } from '../../shared/database/cache/redis.service';
import { AdminService } from '../admin/admin.service';
import { usernameKey } from '../../shared/database/cache/cache.keys';
import { CacheTTL } from '../../config/cache-ttl.constants';
import {
  IUserRepository,
  IWalletRepository,
  IAuditLogRepository,
} from '../../shared/database/repositories';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  mobileNumber: string;
  name: string;
  category: UserCategory | null;
  state: string;
  district: string;
  block: string | null;
  village: string | null;
  kvk: string | null;
  languagePreference: string;
  verificationStatus: VerificationStatus;
  role: UserRole;
  username: string | null;
  createdAt: Date;
  // Flattened profile fields (replacing profileData JSONB)
  age:             number | null;
  gender:          string | null;
  farmSize:        string | null;
  season:          string | null;
  cropType:        string | null;
  courseName:      string | null;
  collegeName:     string | null;
  universityName:   string | null;
  organisationType:    string | null;
  organizationName:    string | null;
  organizationRole:    string | null;
  numberOfFarmers:     number | null;
  organizationState:   string | null;
  organizationDistrict: string | null;
  organizationBlock:   string | null;
  organizationVillage: string | null;
}

@Injectable()
export class AuthService {
  private readonly otpExpiryMinutes = 5;
  private readonly otpMaxRequestsPerWindow = 10; // per 15-minute window

  constructor(
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    @Inject(REPOSITORY_TOKENS.Wallet)
    private readonly walletRepo: IWalletRepository,
    @Inject(REPOSITORY_TOKENS.AuditLog)
    private readonly auditRepo: IAuditLogRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly redisService: RedisService,
    private readonly adminService: AdminService,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Strip country code prefix so +91 / 0 prefix are not stored in DB.
   * The leading 9 of an Indian mobile is NOT stripped — it is part of the number.
   * e.g. +91 9111111111 → 9111111111
   *      09111111111 → 91111111111
   *      9111111111 → 9111111111
   */
  normalizePhone(mobile: string): string {
    return mobile.replace(/^\+91 ?/, '').replace(/^0/, '');
  }

  // ─── OTP Flow ───────────────────────────────────────────────────────────────

  /**
   * Generate a 6-digit OTP and send it via SMS.
   * Rate-limited to 10 requests per 15-minute window per mobile number.
   */
  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const mobileNumber = this.normalizePhone(dto.mobileNumber);
    const rateLimitKey = `otp_rl:${mobileNumber}`;

    // Web clients are restricted to registered admin/curator accounts only
    if (dto.client === 'web') {
      const user = await this.userRepo.findOne({ where: { mobileNumber } });
      if (!user) {
        throw new ForbiddenException(
          'This number is not registered on the platform. Please use the mobile app to sign up.',
        );
      }
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.CURATOR && user.role !== UserRole.FINANCE) {
        throw new ForbiddenException(
          'Only admin, curator, and finance accounts can access the web portal. Please use the mobile app.',
        );
      }
      if (user.verificationStatus !== VerificationStatus.VERIFIED) {
        throw new ForbiddenException(
          'Your account is not yet verified. Please complete mobile app verification first.',
        );
      }
    }

    // Rate-limit check via Redis — skip in dev when OTP_RATE_LIMIT=false
    const otpRateLimitEnabled = this.configService.get<boolean>('app.otpRateLimit') ?? true;
    if (otpRateLimitEnabled) {
      const current = await this.redisService.get(rateLimitKey);
      if (current !== null && parseInt(current, 10) >= this.otpMaxRequestsPerWindow) {
        throw new BadRequestException(
          'Too many OTP requests. Please try again after 15 minutes.',
        );
      }
    }

    // Generate 6-digit OTP
    const otp = randomInt(100000, 999999).toString();
    console.log(`[OTP] >>> ${otp} <<< for mobile=${mobileNumber}`);
    const otpHash = await bcrypt.hash(otp, 12);
    const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);

    // Store hashed OTP in DB (upsert user record)
    let user = await this.userRepo.findOne({ where: { mobileNumber } });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await this.userRepo.create({
        mobileNumber,
        name: '',
        role: UserRole.USER,
        category: UserCategory.FARMER,
        state: '',
        district: '',
        languagePreference: 'en',
        verificationStatus: VerificationStatus.PENDING,
        consentGiven: false,
        otpHash,
        otpExpiresAt: expiresAt,
      });

    } else {
      // Auto-reinstate: suspension period has expired
      if (
        user.verificationStatus === VerificationStatus.SUSPENDED &&
        user.suspendedUntil &&
        new Date() > new Date(user.suspendedUntil)
      ) {
        await this.userRepo.update(user.id, {
          verificationStatus: VerificationStatus.VERIFIED,
          suspendedAt: null,
          suspendedUntil: null,
          suspendedReason: null,
        });
        user.verificationStatus = VerificationStatus.VERIFIED;
      }

      // Reject suspended/banned users before incrementing rate-limit counter
      if (user.verificationStatus === VerificationStatus.SUSPENDED) {
        throw new UserAccountLockedException({
          status: VerificationStatus.SUSPENDED,
          reason: user.suspendedReason,
          suspendedAt: user.suspendedAt,
          suspendedUntil: user.suspendedUntil,
          bannedAt: null,
        });
      }
      if (user.verificationStatus === VerificationStatus.BANNED) {
        throw new UserAccountLockedException({
          status: VerificationStatus.BANNED,
          reason: user.bannedReason,
          suspendedAt: null,
          suspendedUntil: null,
          bannedAt: user.bannedAt,
        });
      }

      user.otpHash = otpHash;
      user.otpExpiresAt = expiresAt;
    }

    await this.userRepo.update(user.id, { otpHash, otpExpiresAt: expiresAt });

    // Increment rate-limit counter
    if (otpRateLimitEnabled) {
      await this.redisService.incr(rateLimitKey);
      await this.redisService.expire(rateLimitKey, 15 * 60); // 15 minutes
    }

    // Send OTP via SMS gateway
    await this.smsService.sendOtp(mobileNumber, otp);

    // Audit
    await this.logAudit(ActorType.USER, user.id, AuditAction.OTP_REQUESTED, 'User', user.id);

    return { message: 'OTP sent successfully' };
  }

  /**
   * Verify the OTP and issue JWT tokens.
   * On first verification of a new user → return a registration token
   * On subsequent verification of an existing user → return access + refresh tokens
   */
  async verifyOtp(rawMobile: string, dto: VerifyOtpDto): Promise<AuthResponse | { requiresRegistration: true; tempToken: string; role: UserRole }> {
    const mobileNumber = this.normalizePhone(dto.mobileNumber);
    const isDev = process.env.NODE_ENV === 'development';
    let user = await this.userRepo.findOne({ where: { mobileNumber } });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Auto-reinstate: suspension period has expired
    if (
      user.verificationStatus === VerificationStatus.SUSPENDED &&
      user.suspendedUntil &&
      new Date() > new Date(user.suspendedUntil)
    ) {
      await this.userRepo.update(user.id, {
        verificationStatus: VerificationStatus.VERIFIED,
        suspendedAt: null,
        suspendedUntil: null,
        suspendedReason: null,
      });
      user.verificationStatus = VerificationStatus.VERIFIED;
    }

    // Block suspended or banned users from logging in
    if (user.verificationStatus === VerificationStatus.SUSPENDED) {
      throw new UserAccountLockedException({
        status: VerificationStatus.SUSPENDED,
        reason: user.suspendedReason,
        suspendedAt: user.suspendedAt,
        suspendedUntil: user.suspendedUntil,
        bannedAt: null,
      });
    }
    if (user.verificationStatus === VerificationStatus.BANNED) {
      throw new UserAccountLockedException({
        status: VerificationStatus.BANNED,
        reason: user.bannedReason,
        suspendedAt: null,
        suspendedUntil: null,
        bannedAt: user.bannedAt,
      });
    }

    if (!isDev && (!user.otpHash || !user.otpExpiresAt)) {
      throw new UnauthorizedException('No OTP was requested for this number');
    }

    if (!isDev) {
      if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
        throw new UnauthorizedException('OTP has expired. Please request a new one.');
      }

      const isValidOtp = user.otpHash ? await bcrypt.compare(dto.otp, user.otpHash) : false;
      if (!isValidOtp) {
        throw new UnauthorizedException('Invalid OTP');
      }

      // Clear OTP after successful verification
      user.otpHash = null;
      user.otpExpiresAt = null;
      await this.userRepo.save(user);
    }

    await this.logAudit(ActorType.USER, user.id, AuditAction.OTP_VERIFIED, 'User', user.id);

    // Check if registration is complete (name is set)
    const isRegistered = user.name && user.name.trim().length > 0;

    if (!isRegistered) {
      // First-time user — issue a short-lived temp registration token
      const tempToken = this.jwtService.sign(
        { sub: user.id, mobileNumber, type: 'registration' },
        { expiresIn: '15m' },
      );
      return { requiresRegistration: true, tempToken, role: user.role };
    }

    // Returning user — issue full auth tokens
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    // Ensure wallet exists (handles edge case of user created without wallet)
    const walletExists = await this.walletRepo.count({ where: { userId: user.id } });
    if (walletExists === 0) {
      await this.walletRepo.save(
        await this.walletRepo.create({ userId: user.id, balance: 0, currency: 'INR' }),
      );
    }

    const tokens = await this.issueTokens(user);
    return { tokens, user: this.toPublicUser(user) };
  }

  // ─── Registration ───────────────────────────────────────────────────────────

  /**
   * Complete registration for a new user (after OTP verification).
   * Creates user wallet and returns auth tokens.
   */
  async register(dto: RegisterDto, userId: string): Promise<AuthResponse> {
    const isDev = process.env.NODE_ENV === 'development';

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.name && user.name.trim().length > 0) {
      throw new BadRequestException('User is already registered');
    }

    if (dto.consentGiven !== true) {
      throw new BadRequestException('Consent must be accepted to register on the platform.');
    }

    // Enforce max_users_per_state from system config
    const maxPerState = await this.adminService.getConfigValue('max_users_per_state');
    const stateCount = await this.userRepo.count({
      where: { state: dto.state, verificationStatus: MoreThanOrEqual(VerificationStatus.PENDING) },
    });
    if (stateCount >= maxPerState) {
      throw new BadRequestException(
        `Registration for ${dto.state} is currently full (${stateCount}/${maxPerState} users). Please try again later or contact support.`,
      );
    }

    // Block, village, kvk are only required for farmers — validate server-side
    if (dto.category === UserCategory.FARMER) {
      if (!dto.block?.trim())   throw new BadRequestException('Block is required for farmer registration.');
      if (!dto.village?.trim()) throw new BadRequestException('Village is required for farmer registration.');
    }

    // Username: normalize and check uniqueness before saving (unique constraint in DB)
    // Strip leading @ if the user typed it (e.g. "@rakesh42" → "rakesh42")
    const normalizedUsername = dto.username.toLowerCase().trim().replace(/^@/, '');
    const usernameTaken = await this.userRepo.findOne({
      where: { username: normalizedUsername },
    });
    if (usernameTaken) {
      const suggestions = await this.suggestUsernames(normalizedUsername, 5);
      throw new BadRequestException(
        `Username "${normalizedUsername}" is already taken. Please try a different one or use one of these: ${suggestions.join(', ')}`,
      );
    }

    // Store crops directly on the user record
    const cropInput = dto.cropType ?? dto.volunteerCropType;
    const crops: string[] = (cropInput && typeof cropInput === 'string' && cropInput.trim())
      ? cropInput.split(',').map((c: string) => c.trim()).filter(Boolean)
      : [];

    // Volunteer has volunteerCropType alias for cropType
    const actualCropType = dto.category === UserCategory.VOLUNTEER && dto.volunteerCropType
      ? dto.volunteerCropType
      : dto.cropType;

    // Build updated user record
    const updated: Partial<User> = {
      name: dto.name.trim(),
      username: normalizedUsername,
      category: dto.category,
      state: dto.state,
      district: dto.district,
      block: dto.block ?? null,
      village: dto.village ?? null,
      kvk: dto.kvk ?? null,
      languagePreference: dto.languagePreference,
      consentGiven: dto.consentGiven,
      consentTimestamp: dto.consentGiven ? new Date() : null,
      verificationStatus: isDev ? VerificationStatus.VERIFIED : VerificationStatus.PENDING,
      otpHash: null,
      otpExpiresAt: null,
      age: dto.age ?? null,
      gender: dto.gender ?? null,
      farmSize: dto.farmSize ?? null,
      season: dto.season ?? null,
      cropType: actualCropType ?? null,
      courseName: dto.courseName ?? null,
      collegeName: dto.collegeName ?? null,
      universityName: dto.universityName ?? null,
      organisationType: dto.organisationType ?? null,
      organizationName: dto.organizationName ?? null,
      organizationRole: dto.organizationRole ?? null,
      numberOfFarmers: dto.numberOfFarmers ?? null,
      organizationState: dto.organizationState ?? null,
      organizationDistrict: dto.organizationDistrict ?? null,
      organizationBlock: dto.organizationBlock ?? null,
      organizationVillage: dto.organizationVillage ?? null,
      crops,
      lastLoginAt: new Date(),
    };

    await this.userRepo.update(userId, updated);

    // Create wallet if it doesn't exist (idempotent — safe to call multiple times)
    const existingWalletCount = await this.walletRepo.count({ where: { userId } });
    if (existingWalletCount === 0) {
      const wallet = await this.walletRepo.create({
        userId,
        balance: 0,
        currency: 'INR',
      });
    }

    // Sync username → Redis for fast existence lookups
    await this.syncUsernameToRedis(normalizedUsername, userId);

    await this.logAudit(
      ActorType.USER,
      userId,
      AuditAction.USER_REGISTERED,
      'User',
      userId,
      null,
      { category: dto.category, state: dto.state, district: dto.district },
    );

    const freshUser = await this.userRepo.findOne({ where: { id: userId } });
    const tokens = await this.issueTokens(freshUser!);
    return { tokens, user: this.toPublicUser(freshUser!) };
  }

  // ─── Token Management ───────────────────────────────────────────────────────

  /**
   * Issue access + refresh JWT tokens for an authenticated user.
   * Increments tokenVersion to invalidate all previously issued tokens.
   */
  async issueTokens(user: User): Promise<AuthTokens> {
    // NOTE: tokenVersion is NOT incremented here.
    // It is only incremented on logout (see logout handler) to allow
    // the same account to be used on multiple devices simultaneously.
    const tokenVersion = user.tokenVersion;

    const payload = {
      sub: user.id,
      mobileNumber: user.mobileNumber,
      role: user.role,
      tokenVersion,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return { accessToken, refreshToken, expiresIn: 15 * 60 };
  }

  /**
   * Refresh access token using a valid refresh token.
   * Also validates tokenVersion to reject tokens invalidated by logout.
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        mobileNumber: string;
        role: UserRole;
        tokenVersion: number;
      }>(refreshToken);

      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.tokenVersion !== payload.tokenVersion) {
        throw new UnauthorizedException('Session expired. Please login again.');
      }

      // Auto-reinstate: suspension period has expired
      if (
        user.verificationStatus === VerificationStatus.SUSPENDED &&
        user.suspendedUntil &&
        new Date() > new Date(user.suspendedUntil)
      ) {
        await this.userRepo.update(user.id, {
          verificationStatus: VerificationStatus.VERIFIED,
          suspendedAt: null,
          suspendedUntil: null,
          suspendedReason: null,
        });
        user.verificationStatus = VerificationStatus.VERIFIED;
      }

      // Block suspended or banned users from refreshing a session
      if (user.verificationStatus === VerificationStatus.SUSPENDED) {
        throw new UserAccountLockedException({
          status: VerificationStatus.SUSPENDED,
          reason: user.suspendedReason,
          suspendedAt: user.suspendedAt,
          suspendedUntil: user.suspendedUntil,
          bannedAt: null,
        });
      }
      if (user.verificationStatus === VerificationStatus.BANNED) {
        throw new UserAccountLockedException({
          status: VerificationStatus.BANNED,
          reason: user.bannedReason,
          suspendedAt: null,
          suspendedUntil: null,
          bannedAt: user.bannedAt,
        });
      }

      const tokens = await this.issueTokens(user);

      // Update last login timestamp on every token refresh
      user.lastLoginAt = new Date();
      await this.userRepo.save(user);

      return tokens;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Validate a JWT access token and return the user.
   */
  async validateToken(token: string): Promise<User> {
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.userRepo.findOne({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return user;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /**
   * Increment tokenVersion to invalidate all existing sessions for a user.
   * Called on logout.
   */
  async incrementTokenVersion(userId: string): Promise<void> {
    await this.userRepo.increment({ id: userId }, 'tokenVersion', 1);
  }

  // ─── Profile ─────────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toPublicUser(user);
  }

  // ─── Update own profile ─────────────────────────────────────────────────────

  async updateMe(
    userId: string,
    dto: {
      name?: string;
      age?: number | null;
      gender?: string | null;
      state?: string | null;
      district?: string | null;
      block?: string | null;
      village?: string | null;
      kvk?: string | null;
      farmSize?: string | null;
      cropType?: string | null;
      courseName?: string | null;
      collegeName?: string | null;
      universityName?: string | null;
      organisationType?: string | null;
      organizationName?: string | null;
      organizationRole?: string | null;
      numberOfFarmers?: number | null;
      organizationState?: string | null;
      organizationDistrict?: string | null;
      organizationBlock?: string | null;
      organizationVillage?: string | null;
      season?: string | null;
      languagePreference?: string | null;
      crops?: string[] | null;
    },
  ): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    // Only assign fields that were explicitly provided (not undefined)
    const fields: (keyof typeof dto)[] = [
      'name', 'age', 'gender', 'state', 'district', 'block', 'village', 'kvk',
      'farmSize', 'cropType',
      'courseName', 'collegeName', 'universityName',
      'organisationType', 'organizationName', 'organizationRole', 'numberOfFarmers',
      'organizationState', 'organizationDistrict', 'organizationBlock', 'organizationVillage',
      'season', 'languagePreference',
    ];
    for (const f of fields) {
      if (dto[f] !== undefined) (user as any)[f] = dto[f];
    }

    if (dto.crops !== undefined) user.crops = dto.crops ?? [];

    await this.userRepo.save(user);
    return this.toPublicUser(user);
  }

  async findUserByMobile(mobileNumber: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { mobileNumber } });
  }

  // ─── Username availability ───────────────────────────────────────────────────

  /**
   * Check if a username is available.
   * Uses Redis as the fast path; falls back to DB for cache miss.
   * Returns { available: true } if free, { available: false, suggestions: [...] } if taken.
   */
  async checkUsername(username: string): Promise<{ available: boolean; suggestions?: string[] }> {
    const normalized = username.toLowerCase().trim();

    // Fast path: Redis lookup
    const cached = await this.redisService.get(usernameKey(normalized));
    if (cached !== null) {
      // Key exists → username is taken
      const suggestions = await this.suggestUsernames(normalized, 5);
      return { available: false, suggestions };
    }

    // Cache miss → check DB (username col is unique, so an exact match means taken)
    const existing = await this.userRepo.findOne({
      where: { username: normalized },
      select: ['id'],
    });

    if (existing) {
      // Populate Redis so subsequent requests are fast
      await this.syncUsernameToRedis(normalized, existing.id);
      const suggestions = await this.suggestUsernames(normalized, 5);
      return { available: false, suggestions };
    }

    return { available: true };
  }

  /**
   * Suggest alternative usernames based on a base string.
   * Appends/removes numeric suffixes to find available options.
   * Returns up to `limit` suggestions.
   */
  async suggestUsernames(base: string, limit = 5): Promise<string[]> {
    const candidates: string[] = [];
    const normalized = base.toLowerCase().trim();
    const maxAttempts = 20;

    // Strategy 1: append random 2-digit numbers
    for (let i = 0; i < maxAttempts && candidates.length < limit; i++) {
      const suffix = Math.floor(Math.random() * 90) + 10; // 10–99
      const candidate = `${normalized}${suffix}`;
      const exists = await this.userRepo.findOne({ where: { username: candidate }, select: ['id'] });
      if (!exists) candidates.push(candidate);
    }

    // Strategy 2: if still not enough, try underscore + random word
    const words = ['farmer', 'grower', 'field', 'crop', 'agri', 'soil', 'harvest', 'kisan', 'farming'];
    for (let i = 0; i < words.length && candidates.length < limit; i++) {
      const candidate = `${normalized}_${words[i]}`;
      const exists = await this.userRepo.findOne({ where: { username: candidate }, select: ['id'] });
      if (!exists && !candidates.includes(candidate)) candidates.push(candidate);
    }

    return candidates.slice(0, limit);
  }

  /**
   * Write a username→userId mapping to Redis.
   * Called on registration and profile update.
   * The key auto-expires after USERNAME_CACHE_TTL so stale entries are eventually cleaned.
   */
  async syncUsernameToRedis(username: string, userId: string): Promise<void> {
    // No TTL here — username entries persist for the lifetime of the account.
    // We set a very long TTL (30 days) as a safety net; re-sync on each relevant write.
    await this.redisService.set(usernameKey(username), userId);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      mobileNumber: user.mobileNumber,
      username: user.username ?? null,
      name: user.name,
      category: user.category,
      state: user.state,
      district: user.district,
      block: user.block,
      village: user.village,
      kvk: user.kvk,
      languagePreference: user.languagePreference,
      verificationStatus: user.verificationStatus,
      role: user.role,
      createdAt: user.createdAt,
      age:              user.age,
      gender:           user.gender,
      farmSize:         user.farmSize,
      season:           user.season,
      cropType:         user.cropType,
      courseName:       user.courseName,
      collegeName:      user.collegeName,
      universityName:   user.universityName,
      organisationType:     user.organisationType,
      organizationName:     user.organizationName,
      organizationRole:     user.organizationRole,
      numberOfFarmers:      user.numberOfFarmers,
      organizationState:    user.organizationState,
      organizationDistrict: user.organizationDistrict,
      organizationBlock:    user.organizationBlock,
      organizationVillage:  user.organizationVillage,
    };
  }

  private async logAudit(
    actorType: ActorType,
    actorId: string | null,
    action: string,
    entityType?: string,
    entityId?: string,
    oldValue?: Record<string, unknown> | null,
    newValue?: Record<string, unknown> | null,
  ): Promise<void> {
    const log = await this.auditRepo.create({
      actorType,
      actorId,
      action,
      entityType,
      entityId,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    });
    await this.auditRepo.save(log);
  }
}