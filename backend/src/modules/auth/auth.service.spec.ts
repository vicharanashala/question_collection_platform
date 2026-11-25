import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { SmsService } from './sms.service';
import { RedisService } from '../../shared/database/cache/redis.service';
import { RateLimitCounterService } from '../../shared/database/cache/rate-limit-counter.service';
import { AdminService } from '../admin/admin.service';
import { AnveshanProgressService } from '../admin/anveshan-progress.service';
import { SessionService } from '../session/session.service';
import { EmailService } from './email.service';
import { UserAccountLockedException } from '../../shared/classes/exceptions/user-status.exception';
// import { User, Wallet, AuditLog } from '../../shared/database/entities';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import {
  UserCategory,
  VerificationStatus,
  UserRole,
  ActorType,
  EmailOtpPurpose,
} from '../../shared/classes/enums';

import { User } from '@/shared/database/mongodb/schemas/user.schema';
import { Types } from 'mongoose';

const mockUserRepo = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
});

const mockWalletRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

const mockAuditRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

const mockDataSource = () => ({
  createQueryRunner: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn(),
});

const mockSmsService = () => ({
  sendOtp: jest.fn(),
});

const mockRateLimitCounterService = () => ({
  peek: jest.fn().mockResolvedValue(null),
  hit: jest.fn().mockResolvedValue({ count: 1, ttlSeconds: 900 }),
  reset: jest.fn(),
});

const mockRedisService = () => ({
  get: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
});

const mockAdminService = () => ({
  getConfigValue: jest.fn((key: string) => {
    const map: Record<string, number> = {
      max_users_per_state: 100,
      daily_question_limit: 20,
      min_withdrawal_amount: 50,
    };
    return Promise.resolve(map[key] ?? 0);
  }),
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let jwtService: ReturnType<typeof mockJwtService>;
  let configService: ReturnType<typeof mockConfigService>;
  let smsService: ReturnType<typeof mockSmsService>;
  let redisService: ReturnType<typeof mockRedisService>;
  let rateLimitCounter: ReturnType<typeof mockRateLimitCounterService>;

  // Factory functions to avoid mutation across tests
  const makeMockUser = (): Partial<User> => ({
    _id: new Types.ObjectId,
    mobileNumber: '+919876543210',
    name: '',
    role: UserRole.USER,
    category: UserCategory.FARMER,
    state: '',
    district: '',
    block: null,
    languagePreference: 'en',
    verificationStatus: VerificationStatus.PENDING,
    consentGiven: false,
    consentTimestamp: null,
    otpHash: null,
    otpExpiresAt: null,
    createdAt: new Date(),
  });

  const makeMockRegisteredUser = (): Partial<User> => ({
    ...makeMockUser(),
    name: 'Ramesh Kumar',
    state: 'Maharashtra',
    district: 'Pune',
    block: 'Haveli',
    village: 'Hadapsar',
    verificationStatus: VerificationStatus.VERIFIED,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: REPOSITORY_TOKENS.User, useFactory: mockUserRepo },
        { provide: REPOSITORY_TOKENS.Wallet, useFactory: mockWalletRepo },
        { provide: REPOSITORY_TOKENS.AuditLog, useFactory: mockAuditRepo },
        { provide: DataSource, useFactory: mockDataSource },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: SmsService, useFactory: mockSmsService },
        { provide: RedisService, useFactory: mockRedisService },
        {
          provide: RateLimitCounterService,
          useFactory: mockRateLimitCounterService,
        },
        { provide: AdminService, useFactory: mockAdminService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(REPOSITORY_TOKENS.User);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    smsService = module.get(SmsService);
    redisService = module.get(RedisService);
    rateLimitCounter = module.get(RateLimitCounterService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── requestOtp ─────────────────────────────────────────────────────────────

  describe('requestOtp', () => {
    const dto = { mobileNumber: '+919876543210' };

    it('should throw BadRequestException when rate limit is exceeded', async () => {
      configService.get.mockReturnValue(true); // rate limit enabled
      rateLimitCounter.peek.mockResolvedValue({ count: 10, ttlSeconds: 900 }); // already at max

      await expect(service.requestOtp(dto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.requestOtp(dto)).rejects.toThrow(
        'Too many OTP requests. Please try again after 15 minutes.',
      );
    });

    it('should skip rate limit when OTP_RATE_LIMIT=false', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'app.otpRateLimit') return false;
        return null;
      });
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue({ ...makeMockUser(), id: 'new-uuid' });
      userRepo.save.mockResolvedValue({ ...makeMockUser(), id: 'new-uuid' });
      smsService.sendOtp.mockResolvedValue(undefined);

      await expect(service.requestOtp(dto)).resolves.toEqual({
        message: 'OTP sent successfully',
      });
    });

    it('should create new user and send OTP for first-time number', async () => {
      configService.get.mockReturnValue(false);
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue(makeMockUser());
      userRepo.save.mockResolvedValue(makeMockUser());
      smsService.sendOtp.mockResolvedValue(undefined);

      const result = await service.requestOtp(dto);

      expect(result).toEqual({ message: 'OTP sent successfully' });
      expect(userRepo.create).toHaveBeenCalled();
      expect(smsService.sendOtp).toHaveBeenCalledWith(
        '9876543210',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('should update OTP fields for existing user without creating new record', async () => {
      configService.get.mockReturnValue(false);
      const existingUser = makeMockUser();
      userRepo.findOne.mockResolvedValue(existingUser);
      userRepo.save.mockResolvedValue(existingUser);
      smsService.sendOtp.mockResolvedValue(undefined);

      await service.requestOtp(dto);

      expect(userRepo.create).not.toHaveBeenCalled();
      expect(smsService.sendOtp).toHaveBeenCalled();
    });

    it('should increment rate limit counter after sending OTP', async () => {
      configService.get.mockReturnValue(true);
      rateLimitCounter.peek.mockResolvedValue({ count: 0, ttlSeconds: 900 });
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue(makeMockUser());
      userRepo.save.mockResolvedValue(makeMockUser());
      smsService.sendOtp.mockResolvedValue(undefined);

      await service.requestOtp(dto);

      expect(rateLimitCounter.hit).toHaveBeenCalledWith(
        'otp_rl:9876543210',
        15 * 60,
      );
    });
  });

  // ─── verifyOtp ──────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    it('should throw UnauthorizedException when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyOtp('+919876543210', { mobileNumber: '+919876543210', otp: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no OTP was requested', async () => {
      userRepo.findOne.mockResolvedValue({ ...makeMockUser(), otpHash: null, otpExpiresAt: null });

      await expect(
        service.verifyOtp('+919876543210', { mobileNumber: '+919876543210', otp: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when OTP is expired', async () => {
      const expiredUser = {
        ...makeMockUser(),
        otpHash: 'hash',
        otpExpiresAt: new Date(Date.now() - 60_000), // 1 min ago
      };
      userRepo.findOne.mockResolvedValue(expiredUser);

      await expect(
        service.verifyOtp('+919876543210', { mobileNumber: '+919876543210', otp: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid OTP', async () => {
      const futureUser = {
        ...makeMockUser(),
        otpHash: await bcrypt.hash('正确的OTP', 12),
        otpExpiresAt: new Date(Date.now() + 5 * 60_000),
      };
      userRepo.findOne.mockResolvedValue(futureUser);

      await expect(
        service.verifyOtp('+919876543210', { mobileNumber: '+919876543210', otp: '000000' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return requiresRegistration=true for a new user with valid OTP', async () => {
      const otp = '123456';
      const otpHash = await bcrypt.hash(otp, 12);
      const newUser = {
        ...makeMockUser(),
        name: '',
        otpHash,
        otpExpiresAt: new Date(Date.now() + 5 * 60_000),
      };
      userRepo.findOne.mockResolvedValue(newUser);
      userRepo.save.mockResolvedValue({ ...newUser, otpHash: null, otpExpiresAt: null });
      jwtService.sign.mockReturnValue('temp-registration-token');

      const result = await service.verifyOtp('+919876543210', {
        mobileNumber: '+919876543210',
        otp,
      });

      expect(result).toHaveProperty('requiresRegistration', true);
      expect(result).toHaveProperty('tempToken');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: newUser._id, mobileNumber: '9876543210', type: 'registration' },
        { expiresIn: '15m' },
      );
    });

    it('should return tokens for a registered user with valid OTP', async () => {
      const otp = '654321';
      const otpHash = await bcrypt.hash(otp, 12);
      const registeredUser = {
        ...makeMockRegisteredUser(),
        otpHash,
        otpExpiresAt: new Date(Date.now() + 5 * 60_000),
      };
      userRepo.findOne.mockResolvedValue(registeredUser);
      userRepo.save.mockResolvedValue({ ...registeredUser, otpHash: null, otpExpiresAt: null });
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.verifyOtp('+919876543210', {
        mobileNumber: '+919876543210',
        otp,
      });

      expect(result).toHaveProperty('tokens');
      expect((result as { tokens: { accessToken: string; refreshToken: string } }).tokens).toHaveProperty('accessToken', 'access-token');
      expect((result as { tokens: { accessToken: string; refreshToken: string } }).tokens).toHaveProperty('refreshToken', 'refresh-token');
      expect(result).toHaveProperty('user');
    });

    it('should clear OTP hash and expiry after successful verification', async () => {
      const otp = '111111';
      const otpHash = await bcrypt.hash(otp, 12);
      const user = {
        ...makeMockRegisteredUser(),
        otpHash,
        otpExpiresAt: new Date(Date.now() + 5 * 60_000),
      };
      userRepo.findOne.mockResolvedValue(user);
      userRepo.save.mockResolvedValue({ ...user, otpHash: null, otpExpiresAt: null });
      jwtService.sign.mockReturnValue('token');

      await service.verifyOtp('+919876543210', {
        mobileNumber: '+919876543210',
        otp,
      });

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ otpHash: null, otpExpiresAt: null }),
      );
    });
  });

  // ─── register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    let mockQueryRunner: {
      connect: jest.Mock;
      startTransaction: jest.Mock;
      commitTransaction: jest.Mock;
      rollbackTransaction: jest.Mock;
      release: jest.Mock;
      manager: {
        findOne: jest.Mock;
        save: jest.Mock;
        create: jest.Mock;
        delete: jest.Mock;
      };
    };

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
        manager: {
          findOne: jest.fn(),
          save: jest.fn(),
          create: jest.fn(),
          delete: jest.fn(),
        },
      };
      (service as unknown as { dataSource: { createQueryRunner: jest.Mock } }).dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.register(
          {
            name: 'Ramesh',
            username: 'ramesh_farmer42',
            mobileNumber: '+919876543210',
            state: 'Maharashtra',
            district: 'Pune',
            block: 'Haveli',
            village: 'Hadapsar',
            category: UserCategory.FARMER,
            languagePreference: 'hi',
            consentGiven: true,
          },
          'user-uuid-1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException when user is already registered', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(makeMockRegisteredUser());

      await expect(
        service.register(
          {
            name: 'Ramesh',
            username: 'ramesh_farmer42',
            mobileNumber: '+919876543210',
            state: 'Maharashtra',
            district: 'Pune',
            block: 'Haveli',
            village: 'Hadapsar',
            category: UserCategory.FARMER,
            languagePreference: 'hi',
            consentGiven: true,
          },
          'user-uuid-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create wallet and return tokens on successful registration', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(makeMockUser());
      mockQueryRunner.manager.create.mockReturnValue({ id: 'wallet-uuid' });
      mockQueryRunner.manager.save.mockResolvedValue({ id: 'wallet-uuid' });
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.register(
        {
          name: 'Ramesh Kumar',
          username: 'ramesh_farmer42',
          mobileNumber: '+919876543210',
          state: 'Maharashtra',
          district: 'Pune',
            block: 'Haveli',
            village: 'Hadapsar',
          category: UserCategory.FARMER,
          languagePreference: 'hi',
          consentGiven: true,
        },
        'user-uuid-1',
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toHaveProperty('tokens');
      expect(result.tokens).toHaveProperty('accessToken', 'access-token');
    });

    it('should rollback transaction on error', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(makeMockUser());
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));
      jwtService.sign.mockReturnValue('token');

      await expect(
        service.register(
          {
            name: 'Ramesh',
            username: 'ramesh_farmer42',
            mobileNumber: '+919876543210',
            state: 'Maharashtra',
            district: 'Pune',
            block: 'Haveli',
            village: 'Hadapsar',
            category: UserCategory.FARMER,
            languagePreference: 'hi',
            consentGiven: true,
          },
          'user-uuid-1',
        ),
      ).rejects.toThrow('DB error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('should set consentGiven=true and consentTimestamp when consent is given', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(makeMockUser());
      mockQueryRunner.manager.create.mockReturnValue({ id: 'wallet-uuid' });
      mockQueryRunner.manager.save.mockResolvedValue({ id: 'wallet-uuid' });
      jwtService.sign.mockReturnValue('token');

      await service.register(
        {
          name: 'Ramesh',
          username: 'ramesh_farmer42',
          mobileNumber: '+919876543210',
          state: 'Maharashtra',
          district: 'Pune',
            block: 'Haveli',
            village: 'Hadapsar',
          category: UserCategory.FARMER,
          languagePreference: 'hi',
          consentGiven: true,
        },
        'user-uuid-1',
      );

      const savedUser = mockQueryRunner.manager.save.mock.calls[0][0];
      expect(savedUser.consentGiven).toBe(true);
      expect(savedUser.consentTimestamp).toBeInstanceOf(Date);
    });
  });

  // ─── refreshTokens ──────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refreshTokens('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user no longer exists', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-uuid-1' });
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshTokens('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return new tokens for valid refresh token', async () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-uuid-1',
        mobileNumber: '+919876543210',
        role: UserRole.USER,
      });
      userRepo.findOne.mockResolvedValue(makeMockRegisteredUser());
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      });
    });
  });

  // ─── getProfile ─────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return a PublicUser when user exists', async () => {
      userRepo.findOne.mockResolvedValue(makeMockRegisteredUser());

      const profile = await service.getProfile('user-uuid-1');

      expect(profile).toHaveProperty('id', 'user-uuid-1');
      expect(profile).toHaveProperty('mobileNumber', '+919876543210');
      expect(profile).toHaveProperty('name', 'Ramesh Kumar');
      expect(profile).not.toHaveProperty('otpHash');
    });
  });

  // ─── issueTokens ────────────────────────────────────────────────────────────

  describe('issueTokens', () => {
    it('should issue access and refresh tokens with correct expiry', async () => {
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const tokens = await service.issueTokens(makeMockRegisteredUser() as User);

      expect(tokens).toHaveProperty('accessToken', 'access-token');
      expect(tokens).toHaveProperty('refreshToken', 'refresh-token');
      expect(tokens).toHaveProperty('expiresIn', 900);
    });
  });
});

// ─── Email OTP ───────────────────────────────────────────────────────────────

// Separate setup with every AuthService dependency, so these tests do not depend on
// the provider list above.
describe('AuthService email OTP', () => {
  const otp = '123456';
  const email = 'farmer@example.com';

  let service: AuthService;
  let userRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
    save: jest.Mock;
    increment: jest.Mock;
  };
  let emailService: { sendSyncEmailToUser: jest.Mock };
  let anveshanRepo: { findByPhone: jest.Mock };

  // A registered user with a pending email OTP for the given purpose.
  const makeUserWithEmailOtp = (
    purpose: EmailOtpPurpose,
    overrides: Partial<User> = {},
  ): User =>
    ({
      _id: new Types.ObjectId(),
      mobileNumber: '9876543210',
      name: 'Ramesh Kumar',
      role: UserRole.USER,
      verificationStatus: VerificationStatus.VERIFIED,
      isDeleted: false,
      email: purpose === EmailOtpPurpose.EMAIL_LOGIN ? email : null,
      emailVerifiedAt:
        purpose === EmailOtpPurpose.EMAIL_LOGIN ? new Date() : null,
      emailOtpHash: bcrypt.hashSync(otp, 4),
      emailOtpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      emailOtpTarget: email,
      emailOtpPurpose: purpose,
      emailOtpAttempts: 0,
      ...overrides,
    }) as User;

  // The repository returns the user, then the attempt count once it is raised, then any extra lookups.
  const mockLookups = (
    user: User,
    attempt: number,
    ...rest: (User | null)[]
  ) => {
    userRepo.findOne
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce({ ...user, emailOtpAttempts: attempt });
    for (const value of rest) userRepo.findOne.mockResolvedValueOnce(value);
  };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
      increment: jest.fn(),
    };
    emailService = { sendSyncEmailToUser: jest.fn() };
    anveshanRepo = { findByPhone: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: REPOSITORY_TOKENS.User, useValue: userRepo },
        {
          provide: REPOSITORY_TOKENS.Wallet,
          useValue: { count: jest.fn().mockResolvedValue(1) },
        },
        { provide: REPOSITORY_TOKENS.AuditLog, useFactory: mockAuditRepo },
        {
          provide: REPOSITORY_TOKENS.Candidate,
          useValue: anveshanRepo,
        },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-token') },
        },
        // Turns off the OTP rate limits and the OTP dev bypass.
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(false) },
        },
        { provide: SmsService, useFactory: mockSmsService },
        { provide: RedisService, useFactory: mockRedisService },
        {
          provide: RateLimitCounterService,
          useFactory: mockRateLimitCounterService,
        },
        { provide: AdminService, useFactory: mockAdminService },
        {
          provide: AnveshanProgressService,
          useValue: { getProgressForUsers: jest.fn() },
        },
        { provide: SessionService, useValue: { create: jest.fn() } },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('verifyEmailLoginFallback', () => {
    it('signs in and clears the used OTP so it cannot be replayed', async () => {
      const user = makeUserWithEmailOtp(EmailOtpPurpose.EMAIL_LOGIN);
      mockLookups(user, 1);

      const result = await service.verifyEmailLoginFallback('9876543210', otp);

      expect(result).toHaveProperty('tokens.accessToken', 'signed-token');
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          emailOtpHash: null,
          emailOtpTarget: null,
          emailOtpPurpose: null,
        }),
      );
    });

    it('rejects a banned account before checking the OTP', async () => {
      userRepo.findOne.mockResolvedValueOnce(
        makeUserWithEmailOtp(EmailOtpPurpose.EMAIL_LOGIN, {
          verificationStatus: VerificationStatus.BANNED,
        }),
      );

      await expect(
        service.verifyEmailLoginFallback('9876543210', otp),
      ).rejects.toThrow(UserAccountLockedException);
      expect(userRepo.increment).not.toHaveBeenCalled();
    });

    it('rejects an OTP that was sent to link an email', async () => {
      userRepo.findOne.mockResolvedValueOnce(
        makeUserWithEmailOtp(EmailOtpPurpose.EMAIL_SYNC, { email }),
      );

      await expect(
        service.verifyEmailLoginFallback('9876543210', otp),
      ).rejects.toThrow('Invalid or expired OTP');
    });

    it('clears the OTP after the last allowed wrong attempt', async () => {
      const user = makeUserWithEmailOtp(EmailOtpPurpose.EMAIL_LOGIN);
      mockLookups(user, 5);

      await expect(
        service.verifyEmailLoginFallback('9876543210', '000000'),
      ).rejects.toThrow('Maximum OTP attempts reached');
      expect(userRepo.update).toHaveBeenCalledWith(
        user._id,
        expect.objectContaining({ emailOtpHash: null }),
      );
    });
  });

  describe('requestEmailLoginFallback', () => {
    it('sends nothing and gives the same reply when no verified email is linked', async () => {
      userRepo.findOne.mockResolvedValueOnce(
        makeUserWithEmailOtp(EmailOtpPurpose.EMAIL_LOGIN, {
          email: null,
          emailVerifiedAt: null,
        }),
      );

      const result = await service.requestEmailLoginFallback('9876543210');

      expect(result.message).toMatch(/^If a verified email is linked/);
      expect(emailService.sendSyncEmailToUser).not.toHaveBeenCalled();
    });

    it('uses the Anveshan email when the first SMS failed before it was copied', async () => {
      const user = makeUserWithEmailOtp(EmailOtpPurpose.EMAIL_LOGIN, {
        email: null,
        emailVerifiedAt: null,
      });
      userRepo.findOne.mockResolvedValueOnce(user).mockResolvedValueOnce(null);
      anveshanRepo.findByPhone.mockResolvedValue({
        email: ' Farmer@Example.com ',
        current_phase: 'module',
      });

      await service.requestEmailLoginFallback('9876543210');

      expect(userRepo.update).toHaveBeenCalledWith(user._id, {
        email,
        emailVerifiedAt: expect.any(Date),
      });
      expect(emailService.sendSyncEmailToUser).toHaveBeenCalledWith(
        email,
        'Login OTP',
        expect.any(String),
      );
    });

    it('emails a login OTP to the linked address', async () => {
      userRepo.findOne.mockResolvedValueOnce(
        makeUserWithEmailOtp(EmailOtpPurpose.EMAIL_LOGIN),
      );

      await service.requestEmailLoginFallback('9876543210');

      expect(userRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          emailOtpTarget: email,
          emailOtpPurpose: EmailOtpPurpose.EMAIL_LOGIN,
        }),
      );
      expect(emailService.sendSyncEmailToUser).toHaveBeenCalledWith(
        email,
        'Login OTP',
        expect.stringMatching(/Your OTP is \d{6}\./),
      );
    });
  });

  describe('email linking', () => {
    it('rejects an email that another account already uses', async () => {
      const user = makeUserWithEmailOtp(EmailOtpPurpose.EMAIL_SYNC);
      userRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ ...user, _id: new Types.ObjectId() });

      await expect(
        service.requestEmailOtp(user._id.toString(), email),
      ).rejects.toThrow(
        'This email is already associated with another account',
      );
      expect(emailService.sendSyncEmailToUser).not.toHaveBeenCalled();
    });

    it('answers a wrong code with 400 so the web client keeps the session', async () => {
      const user = makeUserWithEmailOtp(EmailOtpPurpose.EMAIL_SYNC);
      mockLookups(user, 1);

      await expect(
        service.verifyEmailOtp(user._id.toString(), email, '000000'),
      ).rejects.toThrow(BadRequestException);
    });

    it('links the email once the code matches', async () => {
      const user = makeUserWithEmailOtp(EmailOtpPurpose.EMAIL_SYNC);
      mockLookups(user, 1, null);

      await service.verifyEmailOtp(user._id.toString(), email, otp);

      expect(userRepo.update).toHaveBeenLastCalledWith(user._id, {
        email,
        emailVerifiedAt: expect.any(Date),
      });
    });
  });
});
