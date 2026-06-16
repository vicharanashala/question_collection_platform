import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UserAccountLockedException } from '../common/exceptions/user-status.exception';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, Wallet, AuditLog } from '../database/entities';
import {
  UserCategory,
  VerificationStatus,
  UserRole,
  AuditAction,
  ActorType,
} from '../common/enums';
import { RequestOtpDto, VerifyOtpDto, RegisterDto } from './dto';
import { SmsService } from './sms.service';
import { RedisService } from './redis.service';

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
  languagePreference: string;
  verificationStatus: VerificationStatus;
  role: UserRole;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly otpExpiryMinutes = 5;
  private readonly otpMaxRequestsPerWindow = 3; // per 15-minute window

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly redisService: RedisService,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Strip country code prefix so +91 / 91 / 0 are not stored in DB */
  private normalizePhone(mobile: string): string {
    return mobile.replace(/^\+?91 ?/, '').replace(/^0/, '');
  }

  // ─── OTP Flow ───────────────────────────────────────────────────────────────

  /**
   * Generate a 6-digit OTP and send it via SMS.
   * Rate-limited to 3 requests per 15-minute window per mobile number.
   */
  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const mobileNumber = this.normalizePhone(dto.mobileNumber);
    const rateLimitKey = `otp_rl:${mobileNumber}`;
    console.log(`[DEBUG requestOtp] received mobile=${mobileNumber} (len=${mobileNumber.length})`);

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

    if (!user) {
      user = this.userRepo.create({
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

    await this.userRepo.save(user);

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
    const mobileNumber = this.normalizePhone(rawMobile);
    console.log(`[DEBUG verifyOtp] mobile=${mobileNumber} (len=${mobileNumber.length}) dto=${JSON.stringify(dto)}`);
    const user = await this.userRepo.findOne({ where: { mobileNumber } });

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

    if (!user.otpHash || !user.otpExpiresAt) {
      throw new UnauthorizedException('No OTP was requested for this number');
    }

    if (new Date() > user.otpExpiresAt) {
      throw new UnauthorizedException('OTP has expired. Please request a new one.');
    }

    const isValidOtp = await bcrypt.compare(dto.otp, user.otpHash);
    if (!isValidOtp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Clear OTP after successful verification
    user.otpHash = null;
    user.otpExpiresAt = null;
    await this.userRepo.save(user);

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

    const tokens = await this.issueTokens(user);
    return { tokens, user: this.toPublicUser(user) };
  }

  // ─── Registration ───────────────────────────────────────────────────────────

  /**
   * Complete registration for a new user (after OTP verification).
   * Creates user wallet and returns auth tokens.
   */
  async register(dto: RegisterDto, userId: string): Promise<AuthResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, { where: { id: userId } });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.name && user.name.trim().length > 0) {
        throw new BadRequestException('User is already registered');
      }

      // Update user with registration data
      user.name = dto.name.trim();
      user.category = dto.category;
      user.state = dto.state;
      user.district = dto.district;
      user.block = dto.block ?? null;
      user.languagePreference = dto.languagePreference;
      user.consentGiven = dto.consentGiven;
      user.consentTimestamp = dto.consentGiven ? new Date() : null;
      user.verificationStatus = VerificationStatus.PENDING;
      user.otpHash = null;
      user.otpExpiresAt = null;

      if (dto.profileData) {
        user.profileData = dto.profileData as Record<string, unknown>;
      }

      await queryRunner.manager.save(user);

      // Create wallet
      const wallet = queryRunner.manager.create(Wallet, {
        userId: user.id,
        balance: 0,
        currency: 'INR',
      });
      await queryRunner.manager.save(wallet);

      await queryRunner.commitTransaction();

      await this.logAudit(
        ActorType.USER,
        user.id,
        AuditAction.USER_REGISTERED,
        'User',
        user.id,
        null,
        { category: dto.category, state: dto.state, district: dto.district },
      );

      const tokens = await this.issueTokens(user);
      return { tokens, user: this.toPublicUser(user) };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Token Management ───────────────────────────────────────────────────────

  /**
   * Issue access + refresh JWT tokens for an authenticated user.
   * Increments tokenVersion to invalidate all previously issued tokens.
   */
  async issueTokens(user: User): Promise<AuthTokens> {
    // Increment tokenVersion — invalidates all previously issued tokens
    await this.userRepo.increment({ id: user.id }, 'tokenVersion', 1);
    const updatedUser = await this.userRepo.findOne({ where: { id: user.id } });
    const tokenVersion = updatedUser?.tokenVersion ?? 1;

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

      return this.issueTokens(user);
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

  async findUserByMobile(mobileNumber: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { mobileNumber } });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      mobileNumber: user.mobileNumber,
      name: user.name,
      category: user.category,
      state: user.state,
      district: user.district,
      block: user.block,
      languagePreference: user.languagePreference,
      verificationStatus: user.verificationStatus,
      role: user.role,
      createdAt: user.createdAt,
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
    const log = this.auditRepo.create({
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