import { UserAccountLockedException } from "../../shared/classes/exceptions/user-status.exception";
import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  BadGatewayException,
  Inject,
  Optional,
  HttpException,
} from "@nestjs/common";
import { MoreThanOrEqual } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomInt, randomUUID } from "crypto";
import * as bcrypt from "bcryptjs";
// import { User, Wallet, AuditLog } from "../../shared/database/entities";
import {
  UserCategory,
  VerificationStatus,
  UserRole,
  AuditAction,
  ActorType,
  EmailOtpPurpose,
} from "../../shared/classes/enums";
import { RequestOtpDto, VerifyOtpDto, RegisterDto } from "./dto";
import { SmsService } from "./sms.service";
import { SMS_FAILURE_INFO, classifySmsError } from "./sms-delivery.error";
import { RedisService } from "../../shared/database/cache/redis.service";
import { RateLimitCounterService } from "../../shared/database/cache/rate-limit-counter.service";
import { AdminService } from "../admin/admin.service";
import { AnveshanProgressService } from "../admin/anveshan-progress.service";
import { usernameKey } from "../../shared/database/cache/cache.keys";
import { INCLUDE_DELETED } from "../../shared/database/abstractions/mongo-utils";
import { CacheTTL } from "../../config/cache-ttl.constants";
import { isDevelopment, isProduction } from "../../config/environment";
import {
  IUserRepository,
  IWalletRepository,
  IAuditLogRepository,
  IAnveshanCandidateRepository,
} from "../../shared/database/repositories";
import { REPOSITORY_TOKENS } from "../../shared/database/repositories";
import { User } from "@/shared/database/mongodb/schemas/user.schema";
import { Candidate } from "@/shared/database/mongodb/schemas/anveshan.schema";
import { SessionMeta, SessionService } from "../session/session.service";
import { RequestMeta } from "@/shared/middleware/decorators/request-meta.decorator";
import { EmailService } from "./email.service";
import { buildOtpEmail } from "./templates/otp-email.template";
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// export interface AuthResponse {
//   tokens: AuthTokens;
//   user: PublicUser;
// }

export interface AnveshanPhaseInfo {
  isAnveshanUser: true;
  currentPhase: string;
  requiredPhase: string;
  eligible: boolean;
  /** Question collection progress (0-100), used to tell whether the module phase is really complete. */
  questionProgressPercent: number;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: PublicUser;
  anveshanPhaseInfo?: AnveshanPhaseInfo;
}

/** Returned instead of tokens when the user still has to finish registration. */
export interface RegistrationRequired {
  requiresRegistration: true;
  tempToken: string;
  role: UserRole;
  anveshanPhaseInfo?: AnveshanPhaseInfo;
}

/** Result of an accepted login OTP, whether it was sent by SMS or by email. */
export type LoginResult = AuthResponse | RegistrationRequired;

export interface PublicUser {
  id: string;
  mobileNumber: string | null;
  name: string;
  email: string | null;
  category: UserCategory | null;
  state: string;
  district: string;
  block: string | null;
  village: string | null;
  kvk: string | null;
  languagePreference: string;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  rejectedAt: Date | null;
  role: UserRole;
  username: string | null;
  createdAt: Date;
  // Flattened profile fields (replacing profileData JSONB)
  age: number | null;
  gender: string | null;
  farmSize: string | null;
  season: string | null;
  cropType: string | null;
  courseName: string | null;
  collegeName: string | null;
  universityName: string | null;
  organisationType: string | null;
  organizationName: string | null;
  organizationRole: string | null;
  numberOfFarmers: number | null;
  organizationState: string[] | null;
  organizationDistrict: string | null;
  organizationBlock: string | null;
  organizationVillage: string | null;
  consentGiven: boolean;
  isUserCreatedBySuperAdmin: boolean;
  profileCreatedByAdminCompleted: boolean;
  isAnveshanUser: boolean;
  isTester: boolean;
}

// Anveshan candidates get their profile and email copied once they reach this phase.
const REQUIRED_ANVESHAN_PHASE = "module";

/** Clears a pending email OTP once it is accepted or its attempts run out. */
const CLEARED_EMAIL_OTP = {
  emailOtpHash: null,
  emailOtpExpiresAt: null,
  emailOtpTarget: null,
  emailOtpPurpose: null,
  emailOtpAttempts: 0,
} satisfies Partial<User>;

const EMAIL_TAKEN_MESSAGE =
  "This email is already associated with another account";

// Most characters hidden in a masked email, so the mask does not reveal the exact length.
const MAX_MASKED_CHARACTERS = 6;

/**
 * Hides most of an email's name part for showing before sign-in, keeping the first two
 * characters, the last one and the domain: abiramk0107@gmail.com becomes ab******7@gmail.com.
 */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const start = name.slice(0, name.length > 2 ? 2 : 1);
  const end = name.length > 3 ? name.slice(-1) : "";
  const hidden = Math.min(
    Math.max(name.length - start.length - end.length, 1),
    MAX_MASKED_CHARACTERS,
  );
  return `${start}${"*".repeat(hidden)}${end}@${domain}`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly otpExpiryMinutes = 5;
  private readonly otpMaxRequestsPerWindow = 10; // per 15-minute window
  private readonly otpRateLimitWindowSeconds = 15 * 60;
  private readonly emailOtpMaxAttempts = 5;

  constructor(
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    @Inject(REPOSITORY_TOKENS.Wallet)
    private readonly walletRepo: IWalletRepository,
    @Inject(REPOSITORY_TOKENS.AuditLog)
    private readonly auditRepo: IAuditLogRepository,
    @Inject(REPOSITORY_TOKENS.Candidate)
    private readonly anveshanRepo: IAnveshanCandidateRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly redisService: RedisService,
    private readonly rateLimitCounter: RateLimitCounterService,
    private readonly adminService: AdminService,
    private readonly anveshanProgressService: AnveshanProgressService,
    private readonly sessionService: SessionService,
    private readonly emailService: EmailService,
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
    return mobile.replace(/^\+91 ?/, "").replace(/^0/, "");
  }

  /** Error for too many OTP requests. Its code lets the web app offer the email fallback. */
  private tooManyOtpRequests(): BadRequestException {
    return new BadRequestException({
      statusCode: 400,
      error: "Bad Request",
      code: "OTP_RATE_LIMITED",
      message: "Too many OTP requests. Please try again after 15 minutes.",
    });
  }

  // ─── OTP Flow ───────────────────────────────────────────────────────────────

  /**
   * Generate a 6-digit OTP and send it via SMS.
   * Rate-limited to 10 requests per 15-minute window per mobile number.
   */
  async requestOtp(dto: RequestOtpDto): Promise<{ message: string; otp?: string }> {
    const mobileNumber = this.normalizePhone(dto.mobileNumber);
    const rateLimitKey = `otp_rl:${mobileNumber}`;

    // Web clients are restricted to registered admin/curator/distributor accounts only
    if (dto.client === "web") {
      const user = await this.userRepo.findOne({ where: { mobileNumber } });
      if (!user) {
        throw new ForbiddenException(
          "This number is not registered on the platform. Please use the mobile app to sign up.",
        );
      }

      // if (
      //   user.role !== UserRole.ADMIN &&
      //   user.role !== UserRole.SUPER_ADMIN &&
      //   user.role !== UserRole.CURATOR &&
      //   user.role !== UserRole.FINANCE &&
      //   user.role !== UserRole.DISTRIBUTOR
      // ) {
      //   throw new ForbiddenException(
      //     'Only admin, curator, finance, and distributor accounts can access the web portal. Please use the mobile app.',
      //   );
      // }

      if (user.verificationStatus !== VerificationStatus.VERIFIED) {
        throw new ForbiddenException(
          "Your account is not yet verified. Please complete mobile app verification first.",
        );
      }
    }

    // Rate-limit check via Redis — skip in dev when OTP_RATE_LIMIT=false
    const otpRateLimitEnabled =
      this.configService.get<boolean>("app.otpRateLimit") ?? true;
    if (otpRateLimitEnabled) {
      const current = await this.rateLimitCounter.peek(rateLimitKey);
      if (current !== null && current.count >= this.otpMaxRequestsPerWindow) {
        throw this.tooManyOtpRequests();
      }
    }

    // Generate 6-digit OTP
    const otp = randomInt(100000, 999999).toString();
    // The OTP is a credential — printing it would put it in Cloud Logging for every
    // login. Only local development, which has no real SMS gateway, may see it.
    if (isDevelopment()) {
      this.logger.debug(`[OTP] ${otp} for mobile=${mobileNumber}`);
    }
    const otpHash = await bcrypt.hash(otp, 12);
    const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);

    // Store hashed OTP in DB (upsert user record)
    let user = await this.findUserByMobileIncludingDeleted(mobileNumber);
    let isNewUser = false;

    if (user?.isDeleted) {
      throw new ForbiddenException({
        statusCode: 403,
        error: "Forbidden",
        code: "ACCOUNT_DELETED",
        message: "This user is deleted. Please contact admin to restore.",
      });
    }

    if (!user) {
      isNewUser = true;
      user = await this.userRepo.create({
        mobileNumber,
        name: "",
        role: UserRole.USER,
        category: UserCategory.FARMER,
        state: "",
        district: "",
        languagePreference: "en",
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
        await this.userRepo.update(user._id, {
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

    await this.userRepo.update(user._id, { otpHash, otpExpiresAt: expiresAt });

    // Increment rate-limit counter
    if (otpRateLimitEnabled) {
      await this.rateLimitCounter.hit(
        rateLimitKey,
        this.otpRateLimitWindowSeconds,
      );
    }

    // Send OTP via SMS gateway
    try {
      await this.smsService.sendOtp(mobileNumber, otp);
    } catch (err) {
      const gatewayResponse = err instanceof Error ? err.message : String(err);
      this.logger.error(`OTP delivery failed for ${mobileNumber}: ${gatewayResponse}`);
      throw new BadGatewayException({
        message:
          "We could not send the OTP to this number. Please check the number or try again later.",
        code: "OTP_DELIVERY_FAILED",
        details: this.buildOtpDeliveryDetails(err, gatewayResponse),
      });
    }

    // Audit
    // await this.logAudit(
    //   ActorType.USER,
    //   user.id,
    //   AuditAction.OTP_REQUESTED,
    //   "User",
    //   user.id,
    // );

    return {
      message: "OTP sent successfully",
      ...(isDevelopment() && { otp }),
    };
  }

  // Builds the error details for a failed OTP send. The reason, description and retry
  // hint are always returned. Provider and raw gateway output are returned only outside
  // production, because they can reveal gateway configuration.
  private buildOtpDeliveryDetails(err: unknown, gatewayResponse: string) {
    const reason = classifySmsError(err);
    return {
      reason,
      ...SMS_FAILURE_INFO[reason],
      ...(!isProduction() && {
        provider: this.configService.get<string>("sms.provider") ?? "mock",
        gatewayResponse,
      }),
    };
  }

  /**
   * Verify the OTP and issue JWT tokens.
   * On first verification of a new user → return a registration token
   * On subsequent verification of an existing user → return access + refresh tokens
   */
  async verifyOtp(
    rawMobile: string,
    dto: VerifyOtpDto,
    meta?: RequestMeta
  ): Promise<LoginResult> {
    const mobileNumber = this.normalizePhone(dto.mobileNumber);
    // Opt-in local shortcut for developing without a live SMS gateway. main.ts refuses
    // to boot if this is ever enabled in production.
    const bypassOtpChecks =
      (this.configService.get<boolean>("app.otpDevBypass") ?? false) &&
      isDevelopment();
    const user = await this.findUserByMobileIncludingDeleted(mobileNumber);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    await this.assertUserCanLogin(user);

    if (!bypassOtpChecks && (!user.otpHash || !user.otpExpiresAt)) {
      throw new UnauthorizedException("No OTP was requested for this number");
    }

    if (!bypassOtpChecks) {
      if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
        throw new UnauthorizedException(
          "OTP has expired. Please request a new one.",
        );
      }

      const isValidOtp = user.otpHash
        ? await bcrypt.compare(dto.otp, user.otpHash)
        : false;
      if (!isValidOtp) {
        throw new UnauthorizedException("Invalid OTP");
      }

      // Clear OTP after successful verification
      user.otpHash = null;
      user.otpExpiresAt = null;
      await this.userRepo.save(user);
    }

    // await this.logAudit(
    //   ActorType.USER,
    //   user.id,
    //   AuditAction.OTP_VERIFIED,
    //   "User",
    //   user.id,
    // );

    return this.completeLogin(user, mobileNumber, meta);
  }

  /** Rejects deleted, suspended and banned accounts, and lifts a suspension that has expired. */
  private async assertUserCanLogin(user: User): Promise<void> {
    if (user.isDeleted) {
      throw new ForbiddenException({
        statusCode: 403,
        error: "Forbidden",
        code: "ACCOUNT_DELETED",
        message: "This user is deleted. Please contact admin to restore.",
      });
    }

    // Auto-reinstate: suspension period has expired
    if (
      user.verificationStatus === VerificationStatus.SUSPENDED &&
      user.suspendedUntil &&
      new Date() > new Date(user.suspendedUntil)
    ) {
      await this.userRepo.update(user._id, {
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
  }

  /**
   * Finishes a login once the OTP is accepted: applies the Anveshan status, returns a
   * registration token to users who have not registered, and otherwise issues tokens.
   */
  private async completeLogin(
    user: User,
    mobileNumber: string,
    meta?: RequestMeta,
  ): Promise<LoginResult> {
    const anveshanCandidate = await this.anveshanRepo.findByPhone(mobileNumber);
    let anveshanPhaseInfo: AnveshanPhaseInfo | undefined;

    if (anveshanCandidate) {
      const eligible =
        anveshanCandidate.current_phase === REQUIRED_ANVESHAN_PHASE;
      const progressByUser =
        await this.anveshanProgressService.getProgressForUsers([
          user._id.toString(),
        ]);
      anveshanPhaseInfo = {
        isAnveshanUser: true,
        currentPhase: anveshanCandidate.current_phase as string,
        requiredPhase: REQUIRED_ANVESHAN_PHASE,
        eligible,
        questionProgressPercent:
          progressByUser.get(user._id.toString())?.percent ?? 0,
      };

      if (eligible) {
        this.logger.debug(`User ${mobileNumber} belongs to Anveshan platform`);

        const updates: Partial<User> = {
          isAnveshanUser: true,
          category: UserCategory.ANVESHAN_USER,
          verificationStatus: VerificationStatus.VERIFIED,
        };

        if (!user.name?.trim() && anveshanCandidate.full_name) {
          updates.name = anveshanCandidate.full_name;
        }
        if (!user.state?.trim() && anveshanCandidate.state) {
          updates.state = anveshanCandidate.state;
        }
        if (!user.district?.trim() && anveshanCandidate.district) {
          updates.district = anveshanCandidate.district;
        }
        const anveshanEmail = await this.findAnveshanEmailToLink(
          user,
          anveshanCandidate,
        );
        if (anveshanEmail) {
          updates.email = anveshanEmail;
          updates.emailVerifiedAt = new Date();
        }

        await this.userRepo.update(user._id, updates);
        user = { ...user, ...updates } as User;
      } else {
        // Flag them as an Anveshan user for tracking, but withhold verification
        // and profile backfill until they reach the required phase.
        const updates: Partial<User> = {
          isAnveshanUser: true,
          category: UserCategory.ANVESHAN_USER,
        };
        await this.userRepo.update(user._id, updates);
        user = { ...user, ...updates } as User;
      }
    }

    // Check if registration is complete (name is set)
    const isRegistered = user.name && user.name.trim().length > 0;

    if (!isRegistered) {
      const tempToken = this.jwtService.sign(
        { sub: user._id.toString(), mobileNumber, type: "registration" },
        { expiresIn: "1h" },
      );
      return {
        requiresRegistration: true,
        tempToken,
        role: user.role,
        anveshanPhaseInfo,
      };
    }

    // Returning user — issue full auth tokens
    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const walletExists = await this.walletRepo.count({
      where: { userId: user._id.toString() },
    });
    if (walletExists === 0) {
      await this.walletRepo.save(
        await this.walletRepo.create({
          userId: user._id.toString(),
          balance: 0,
          currency: "INR",
        }),
      );
    }

    const tokens = await this.issueTokens(user, meta);
    return { tokens, user: this.toPublicUser(user), anveshanPhaseInfo };
  }

  // ─── Registration ───────────────────────────────────────────────────────────

  /**
   * Complete registration for a new user (after OTP verification).
   * Creates user wallet and returns auth tokens.
   */
  async register(dto: RegisterDto, userId: string, meta?:RequestMeta): Promise<AuthResponse> {
    const user = await this.userRepo.findOne({ where: { _id: userId } });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (user.name && user.name.trim().length > 0) {
      throw new BadRequestException("User is already registered");
    }

    if (dto.consentGiven !== true) {
      throw new BadRequestException(
        "Consent must be accepted to register on the platform.",
      );
    }

    // Enforce max_users_per_state from system config
    const maxPerState = await this.adminService.getConfigValue(
      "max_users_per_state",
    );
    const stateCount = await this.userRepo.count({
      where: {
        state: dto.state,
        verificationStatus: MoreThanOrEqual(VerificationStatus.PENDING),
      },
    });
    if (stateCount >= maxPerState) {
      throw new BadRequestException(
        `Registration for ${dto.state} is currently full (${stateCount}/${maxPerState} users). Please try again later or contact support.`,
      );
    }

    // Block, village, kvk are only required for farmers — validate server-side
    if (dto.category === UserCategory.FARMER) {
      if (!dto.block?.trim())
        throw new BadRequestException(
          "Block is required for farmer registration.",
        );
      if (!dto.village?.trim())
        throw new BadRequestException(
          "Village is required for farmer registration.",
        );
    }

    // Username: normalize and check uniqueness before saving (unique constraint in DB)
    // Strip leading @ if the user typed it (e.g. "@rakesh42" → "rakesh42")
    const normalizedUsername = dto?.username
      .toLowerCase()
      .trim()
      .replace(/^@/, "");
    const usernameTaken = await this.userRepo.findOne({
      where: { username: normalizedUsername },
    });
    if (usernameTaken) {
      const suggestions = await this.suggestUsernames(normalizedUsername, 5);
      throw new BadRequestException(
        `Username "${normalizedUsername}" is already taken. Please try a different one or use one of these: ${suggestions.join(", ")}`,
      );
    }

    // Store crops directly on the user record
    const cropInput = dto.cropType ?? dto.volunteerCropType;
    const crops: string[] =
      cropInput && typeof cropInput === "string" && cropInput.trim()
        ? cropInput
            .split(",")
            .map((c: string) => c.trim())
            .filter(Boolean)
        : [];

    // Volunteer has volunteerCropType alias for cropType
    const actualCropType =
      dto.category === UserCategory.VOLUNTEER && dto.volunteerCropType
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
      verificationStatus: VerificationStatus.PENDING,
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
      isUserCreatedBySuperAdmin: dto.isUserCreatedBySuperAdmin,
    };

    await this.userRepo.update(userId, updated);

    // Create wallet if it doesn't exist (idempotent — safe to call multiple times)
    const existingWalletCount = await this.walletRepo.count({
      where: { userId },
    });
    if (existingWalletCount === 0) {
      const wallet = await this.walletRepo.create({
        userId,
        balance: 0,
        currency: "INR",
      });
    }

    // Sync username → Redis for fast existence lookups
    await this.syncUsernameToRedis(normalizedUsername, userId);

    // await this.logAudit(
    //   ActorType.USER,
    //   userId,
    //   AuditAction.USER_REGISTERED,
    //   "User",
    //   userId,
    //   null,
    //   { category: dto.category, state: dto.state, district: dto.district },
    // );

    const freshUser = await this.userRepo.findOne({ where: { id: userId } });
    const tokens = await this.issueTokens(freshUser!, meta);
    return { tokens, user: this.toPublicUser(freshUser!) };
  }

  // ─── Token Management ───────────────────────────────────────────────────────

  /**
   * Issue access + refresh JWT tokens for an authenticated user.
   * Increments tokenVersion to invalidate all previously issued tokens.
   */
  async issueTokens(user: User, meta?: SessionMeta): Promise<AuthTokens> {
    // NOTE: tokenVersion is NOT incremented here. Each login creates a new session
    // that replaces the user's previous one, so only one device stays logged in.
    const sid = randomUUID()
    const tokenVersion = user.tokenVersion;
    const base = {
      sub: user._id.toString(),
      mobileNumber: user.mobileNumber,
      role: user.role,
      tokenVersion: tokenVersion,
      sid,
    };

    const accessToken = this.jwtService.sign({ ...base, type: 'access' }, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign({ ...base, type: 'refresh' }, { expiresIn: '7d' });

    await this.sessionService.create({
      sessionId: sid,
      userId: user._id.toString(),
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      meta,
    });

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
      sid?: string;
      type?: string;
    }>(refreshToken);

    // reject access tokens, registration tokens, and old tokens that have no sid
    if (payload.type !== "refresh" || !payload.sid) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // session must exist, be unexpired, and match this refresh token
    await this.sessionService.validateRefresh(payload.sid, payload.sub, refreshToken);

    // Deleted users are included so they get the ACCOUNT_DELETED response instead of "User not found".
    const user = await this.userRepo.findOne({
      where: { id: payload.sub, isDeleted: INCLUDE_DELETED },
    });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Checked before tokenVersion, because deleting a user also bumps tokenVersion.
    if (user.isDeleted) {
      throw new ForbiddenException({
        statusCode: 403,
        error: "Forbidden",
        code: "ACCOUNT_DELETED",
        message: "This user is deleted. Please contact admin to restore.",
      });
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException("Session expired. Please login again.");
    }

    // Auto-reinstate: suspension period has expired
    if (
      user.verificationStatus === VerificationStatus.SUSPENDED &&
      user.suspendedUntil &&
      new Date() > new Date(user.suspendedUntil)
    ) {
      await this.userRepo.update(user._id, {
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

    // Same session, same refresh token: only a new access token is issued
    const accessToken = this.jwtService.sign(
      {
        sub: user._id.toString(),
        mobileNumber: user.mobileNumber,
        role: user.role,
        tokenVersion: user.tokenVersion,
        sid: payload.sid,
        type: "access",
      },
      { expiresIn: "15m" },
    );

    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    return { accessToken, refreshToken, expiresIn: 15 * 60 };
  } catch (err) {
    // Rethrow every HttpException (401 with SESSION_REVOKED, 503, account locked)
    if (err instanceof HttpException) throw err;
    throw new UnauthorizedException("Invalid or expired refresh token");
  }
}

  /**
   * Validate a JWT access token and return the user.
   */
  async validateToken(token: string): Promise<User> {
  try {
    const payload = this.jwtService.verify<{ sub: string; sid?: string; type?: string }>(token);
    if (payload.type !== "access" || !payload.sid) {
      throw new UnauthorizedException("Invalid access token");
    }
    await this.sessionService.validateAccess(payload.sid, payload.sub);

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException("User not found");
    return user;
  } catch (err) {
    if (err instanceof HttpException) throw err;
    throw new UnauthorizedException("Invalid or expired access token");
  }
}

async logout(userId: string, sid: string): Promise<void> {
  // Deletes only if sid is still the user's current session, so a stale
  // device can't log out a newer login. Idempotent: 0 deleted is fine.
  await this.sessionService.revoke(sid, userId);
}

  /**
   * Increment tokenVersion to invalidate all existing sessions for a user.
   * Called on logout.
   */
  async incrementTokenVersion(userId: string): Promise<void> {
    await this.userRepo.increment({ id: userId }, "tokenVersion", 1);
  }

  // ─── Profile ─────────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return this.toPublicUser(user);
  }

  // ─── Update own profile ─────────────────────────────────────────────────────

  async updateMe(
    userId: string,
    dto: {
      name?: string;
      username?: string;
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
      organizationState?: string[] | null;
      organizationDistrict?: string | null;
      organizationBlock?: string | null;
      organizationVillage?: string | null;
      season?: string | null;
      languagePreference?: string | null;
      consentGiven?: boolean;
      profileCreatedByAdminCompleted?: boolean;
      resubmitForApproval?: boolean;
      crops?: string[] | null;
    },
  ): Promise<PublicUser> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");

    if (dto.username !== undefined) {
      const username = dto.username.trim().toLowerCase();
      const existing = await this.userRepo.findOne({
        where: { username },
        select: ["id"],
      });
      if (existing && existing._id.toString() !== user._id.toString())
        throw new BadRequestException("That username is already taken.");
      if (user.username && user.username !== username)
        await this.redisService.del(usernameKey(user.username));
      user.username = username;
      await this.syncUsernameToRedis(username, user._id.toString());
    }

    // Only assign fields that were explicitly provided (not undefined)
    const fields: (keyof typeof dto)[] = [
      "name",
      "age",
      "gender",
      "state",
      "district",
      "block",
      "village",
      "kvk",
      "farmSize",
      "cropType",
      "courseName",
      "collegeName",
      "universityName",
      "organisationType",
      "organizationName",
      "organizationRole",
      "numberOfFarmers",
      "organizationState",
      "organizationDistrict",
      "organizationBlock",
      "organizationVillage",
      "season",
      "languagePreference",
      "consentGiven",
      "profileCreatedByAdminCompleted",
    ];
    for (const f of fields) {
      if (dto[f] !== undefined) (user as any)[f] = dto[f];
    }

    if (dto.crops !== undefined) {
      user.crops = dto.crops ?? [];
    } else if (dto.cropType !== undefined) {
      // Keep the searchable crop array aligned when the profile editor changes
      // the display string (the registration flow initializes both fields).
      user.crops = dto.cropType
        ? dto.cropType
            .split(",")
            .map((crop) => crop.trim())
            .filter(Boolean)
        : [];
    }

    // When a rejected user updates their profile (and doesn't opt out), resubmit for admin review.
    if (
      user.verificationStatus === VerificationStatus.REJECTED &&
      dto.resubmitForApproval !== false
    ) {
      user.verificationStatus = VerificationStatus.PENDING;
      user.rejectionReason = null;
      user.rejectedAt = null;
    }

    await this.userRepo.save(user);
    return this.toPublicUser(user);
  }

  // Finds the active user for a mobile number, falling back to a deleted one.
  private async findUserByMobileIncludingDeleted(
    mobileNumber: string,
  ): Promise<User | null> {
    const activeUser = await this.userRepo.findOne({ where: { mobileNumber } });
    if (activeUser) return activeUser;
    return this.userRepo.findOne({ where: { mobileNumber, isDeleted: true } });
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
  async checkUsername(
    username: string,
  ): Promise<{ available: boolean; suggestions?: string[] }> {
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
      select: ["_id"],
    });

    if (existing) {
      // Populate Redis so subsequent requests are fast
      await this.syncUsernameToRedis(normalized, existing._id.toString());
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
      const exists = await this.userRepo.findOne({
        where: { username: candidate },
        select: ["id"],
      });
      if (!exists) candidates.push(candidate);
    }

    // Strategy 2: if still not enough, try underscore + random word
    const words = [
      "farmer",
      "grower",
      "field",
      "crop",
      "agri",
      "soil",
      "harvest",
      "kisan",
      "farming",
    ];
    for (let i = 0; i < words.length && candidates.length < limit; i++) {
      const candidate = `${normalized}_${words[i]}`;
      const exists = await this.userRepo.findOne({
        where: { username: candidate },
        select: ["id"],
      });
      if (!exists && !candidates.includes(candidate))
        candidates.push(candidate);
    }

    return candidates.slice(0, limit);
  }

  // ─── Email OTP ──────────────────────────────────────────────────────────────

  /** Sends an OTP to an email address the signed-in user wants to link. */
  async requestEmailOtp(
    userId: string,
    rawEmail: string,
  ): Promise<{ message: string }> {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.findUserForEmailLink(userId);
    if (await this.isEmailTaken(email, userId)) {
      throw new BadRequestException(EMAIL_TAKEN_MESSAGE);
    }

    await this.sendEmailOtp(user, email, EmailOtpPurpose.EMAIL_SYNC);
    return { message: "OTP sent successfully" };
  }

  /** Links the email address to the signed-in user once its OTP is confirmed. */
  async verifyEmailOtp(
    userId: string,
    rawEmail: string,
    otp: string,
  ): Promise<{ message: string }> {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.findUserForEmailLink(userId);

    // A wrong code is a 400, not a 401, so the web client does not treat it as an expired session.
    const rejection = await this.consumeEmailOtp(
      user,
      otp,
      EmailOtpPurpose.EMAIL_SYNC,
      email,
    );
    if (rejection) {
      throw new BadRequestException(rejection);
    }
    if (await this.isEmailTaken(email, userId)) {
      throw new BadRequestException(EMAIL_TAKEN_MESSAGE);
    }

    await this.userRepo.update(user._id, {
      email,
      emailVerifiedAt: new Date(),
    });
    return { message: "Email verified and synced successfully" };
  }

  // Returns the masked email a login code would go to, so the user can check it before sending.
  async previewEmailLoginFallback(
    rawMobile: string,
  ): Promise<{ maskedEmail: string }> {
    const { email } = await this.resolveEmailLoginFallback(rawMobile);
    return { maskedEmail: maskEmail(email) };
  }

  /**
   * Sends a login OTP to the verified email linked to a mobile number, for when the
   * mobile OTP cannot be delivered, and returns the address masked so the user knows
   * where to look. Locked accounts get the same errors as requestOtp.
   */
  async requestEmailLoginFallback(
    rawMobile: string,
  ): Promise<{ message: string; maskedEmail: string }> {
    const { user, email, fromAnveshan } =
      await this.resolveEmailLoginFallback(rawMobile);

    // An Anveshan user whose first SMS failed has not had the Anveshan email copied
    // yet, because that normally happens at login. Copy it now so the code can be sent.
    if (fromAnveshan) {
      const linked = { email, emailVerifiedAt: new Date() };
      await this.userRepo.update(user._id, linked);
      Object.assign(user, linked);
    }

    await this.sendEmailOtp(user, email, EmailOtpPurpose.EMAIL_LOGIN);
    const maskedEmail = maskEmail(email);
    return { message: `OTP sent to ${maskedEmail}`, maskedEmail };
  }

  // Finds the email a login code can be sent to for a mobile number, without changing anything.
  private async resolveEmailLoginFallback(
    rawMobile: string,
  ): Promise<{ user: User; email: string; fromAnveshan: boolean }> {
    const mobileNumber = this.normalizePhone(rawMobile);
    const user = await this.findUserByMobileIncludingDeleted(mobileNumber);
    if (!user) {
      throw this.emailNotLinked();
    }
    await this.assertUserCanLogin(user);

    if (user.email) {
      if (!user.emailVerifiedAt) {
        throw this.emailNotLinked();
      }
      return { user, email: user.email, fromAnveshan: false };
    }

    const candidate = await this.anveshanRepo.findByPhone(mobileNumber);
    // An Anveshan candidate whose email can only be used after the Ground Truth Module
    // is told to finish it, instead of being told that no email is linked.
    if (
      candidate?.email?.trim() &&
      candidate.current_phase !== REQUIRED_ANVESHAN_PHASE
    ) {
      throw this.anveshanPhasePending(candidate.current_phase);
    }
    const anveshanEmail = await this.findAnveshanEmailToLink(user, candidate);
    if (!anveshanEmail) {
      throw this.emailNotLinked();
    }
    return { user, email: anveshanEmail, fromAnveshan: true };
  }

  /** Error for an Anveshan candidate who has not reached the phase where their email is used. */
  private anveshanPhasePending(
    currentPhase: string | null,
  ): BadRequestException {
    return new BadRequestException({
      statusCode: 400,
      error: "Bad Request",
      code: "ANVESHAN_PHASE_PENDING",
      message:
        "Your account needs to be in the Ground Truth Module on the Anveshan platform to receive sign-in codes by email.",
      details: { currentPhase, requiredPhase: REQUIRED_ANVESHAN_PHASE },
    });
  }

  /** Error for a login fallback on an account with no verified email. Its code lets the web app explain it. */
  private emailNotLinked(): BadRequestException {
    return new BadRequestException({
      statusCode: 400,
      error: "Bad Request",
      code: "EMAIL_NOT_LINKED",
      message: "No email is linked with this account.",
    });
  }

  /** Signs in with an email OTP from the login fallback. Returns the same result as verifyOtp. */
  async verifyEmailLoginFallback(
    rawMobile: string,
    otp: string,
    meta?: RequestMeta,
  ): Promise<LoginResult> {
    const mobileNumber = this.normalizePhone(rawMobile);
    const user = await this.findUserByMobileIncludingDeleted(mobileNumber);
    if (!user?.email) {
      throw new UnauthorizedException("Invalid or expired OTP");
    }
    await this.assertUserCanLogin(user);

    const rejection = await this.consumeEmailOtp(
      user,
      otp,
      EmailOtpPurpose.EMAIL_LOGIN,
      user.email,
    );
    if (rejection) {
      throw new UnauthorizedException(rejection);
    }
    return this.completeLogin(user, mobileNumber, meta);
  }

  /** Loads the signed-in user for email linking. Each account can link one email. */
  private async findUserForEmailLink(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { _id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (user.email) {
      throw new BadRequestException(
        "An email address is already linked to this account",
      );
    }
    return user;
  }

  /**
   * Returns the email from an Anveshan record that has reached the required phase, when
   * the account has no email yet and no other active account uses it. Anveshan
   * addresses are treated as verified.
   */
  private async findAnveshanEmailToLink(
    user: User,
    candidate: Candidate | null,
  ): Promise<string | null> {
    const email = candidate?.email?.trim().toLowerCase();
    if (
      user.email ||
      !email ||
      candidate?.current_phase !== REQUIRED_ANVESHAN_PHASE
    ) {
      return null;
    }
    return (await this.isEmailTaken(email, user._id.toString())) ? null : email;
  }

  /** True when another active account uses this email. Deleted accounts do not block it. */
  private async isEmailTaken(email: string, userId: string): Promise<boolean> {
    const owner = await this.userRepo.findOne({ where: { email } });
    return !!owner && owner._id.toString() !== userId;
  }

  /** Applies the email OTP rate limits, stores a new OTP for the purpose and emails it. */
  private async sendEmailOtp(
    user: User,
    email: string,
    purpose: EmailOtpPurpose,
  ): Promise<void> {
    const userId = user._id.toString();
    const rateLimitKeys = [
      `email_otp_rl:${email}`,
      `email_otp_user_rl:${userId}`,
    ];
    const otpRateLimitEnabled =
      this.configService.get<boolean>("app.otpRateLimit") ?? true;
    if (otpRateLimitEnabled) {
      const counters = await Promise.all(
        rateLimitKeys.map((key) => this.rateLimitCounter.peek(key)),
      );
      if (
        counters.some(
          (counter) =>
            counter !== null && counter.count >= this.otpMaxRequestsPerWindow,
        )
      ) {
        throw this.tooManyOtpRequests();
      }
    }

    const otp = randomInt(100000, 999999).toString();
    // The OTP is a credential, so only local development may log it.
    if (isDevelopment()) {
      this.logger.debug(`[OTP] ${otp} for email=${email}`);
    }
    await this.userRepo.update(user._id, {
      emailOtpHash: await bcrypt.hash(otp, 12),
      emailOtpExpiresAt: new Date(
        Date.now() + this.otpExpiryMinutes * 60 * 1000,
      ),
      emailOtpTarget: email,
      emailOtpPurpose: purpose,
      emailOtpAttempts: 0,
    });

    if (otpRateLimitEnabled) {
      await Promise.all(
        rateLimitKeys.map((key) =>
          this.rateLimitCounter.hit(key, this.otpRateLimitWindowSeconds),
        ),
      );
    }

    try {
      const message = buildOtpEmail(otp, purpose, this.otpExpiryMinutes);
      await this.emailService.sendSyncEmailToUser(
        email,
        message.subject,
        message.text,
        message.html,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Email OTP delivery failed for user ${userId}: ${reason}`,
      );
      throw new BadGatewayException({
        message: "We could not send the OTP. Please try again later.",
        code: "EMAIL_OTP_DELIVERY_FAILED",
        ...(isDevelopment() && { detail: reason }),
      });
    }
  }

  /**
   * Checks an OTP against the user's pending email OTP for this purpose and address.
   * The pending OTP is cleared once it is accepted or its attempts run out.
   * Returns why the OTP was rejected, or null when it is accepted.
   */
  private async consumeEmailOtp(
    user: User,
    otp: string,
    purpose: EmailOtpPurpose,
    email: string,
  ): Promise<string | null> {
    const { emailOtpHash, emailOtpExpiresAt } = user;
    if (
      !emailOtpHash ||
      !emailOtpExpiresAt ||
      user.emailOtpPurpose !== purpose ||
      user.emailOtpTarget !== email
    ) {
      return "Invalid or expired OTP";
    }
    if (new Date() > new Date(emailOtpExpiresAt)) {
      return "OTP has expired. Please request a new one.";
    }

    const attempt = await this.recordEmailOtpAttempt(user);
    const accepted =
      attempt <= this.emailOtpMaxAttempts &&
      (await bcrypt.compare(otp, emailOtpHash));
    if (accepted || attempt >= this.emailOtpMaxAttempts) {
      await this.userRepo.update(user._id, CLEARED_EMAIL_OTP);
      // Keep the loaded user in step, so a later save() cannot restore the used OTP.
      Object.assign(user, CLEARED_EMAIL_OTP);
    }
    if (accepted) return null;
    return attempt >= this.emailOtpMaxAttempts
      ? "Maximum OTP attempts reached. Please request a new OTP."
      : "Invalid OTP";
  }

  /**
   * Counts one email OTP attempt and returns the new total. The count is raised in the
   * database before the OTP is compared, so parallel guesses cannot get past the limit.
   */
  private async recordEmailOtpAttempt(user: User): Promise<number> {
    await this.userRepo.increment(
      { id: user._id.toString() },
      "emailOtpAttempts",
      1,
    );
    const counted = await this.userRepo.findOne({ where: { _id: user._id } });
    return counted?.emailOtpAttempts ?? Number.POSITIVE_INFINITY;
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
      id: user._id.toString(),
      mobileNumber: user.mobileNumber,
      username: user.username ?? null,
      name: user.name,
      email: user.email ?? null,
      category: user.category,
      state: user.state,
      district: user.district,
      block: user.block,
      village: user.village,
      kvk: user.kvk,
      languagePreference: user.languagePreference,
      verificationStatus: user.verificationStatus,
      rejectionReason: user.rejectionReason ?? null,
      rejectedAt: user.rejectedAt ?? null,
      role: user.role,
      createdAt: user.createdAt,
      age: user.age,
      gender: user.gender,
      farmSize: user.farmSize,
      season: user.season,
      cropType: user.cropType,
      courseName: user.courseName,
      collegeName: user.collegeName,
      universityName: user.universityName,
      organisationType: user.organisationType,
      organizationName: user.organizationName,
      organizationRole: user.organizationRole,
      numberOfFarmers: user.numberOfFarmers,
      organizationState: user.organizationState,
      organizationDistrict: user.organizationDistrict,
      organizationBlock: user.organizationBlock,
      organizationVillage: user.organizationVillage,
      consentGiven: user.consentGiven,
      isUserCreatedBySuperAdmin: user.isUserCreatedBySuperAdmin,
      profileCreatedByAdminCompleted: user.profileCreatedByAdminCompleted,
      isAnveshanUser: user.isAnveshanUser,
      isTester: !!user.is_tester,
    };
  }

  // private async logAudit(
  //   actorType: ActorType,
  //   actorId: string | null,
  //   action: string,
  //   entityType?: string,
  //   entityId?: string,
  //   oldValue?: Record<string, unknown> | null,
  //   newValue?: Record<string, unknown> | null,
  // ): Promise<void> {
  //   const log = await this.auditRepo.create({
  //     actorType,
  //     actorId,
  //     action,
  //     entityType,
  //     entityId,
  //     oldValue: oldValue ?? null,
  //     newValue: newValue ?? null,
  //   });
  //   await this.auditRepo.save(log);
  // }
}
