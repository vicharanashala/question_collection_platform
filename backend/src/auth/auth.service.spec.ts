import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { SmsService } from './sms.service';
import { RedisService } from './redis.service';
import { AdminService } from '../admin/admin.service';
import { User, Wallet, AuditLog } from '../database/entities';
import {
  UserCategory,
  VerificationStatus,
  UserRole,
  ActorType,
} from '../common/enums';

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

  // Factory functions to avoid mutation across tests
  const makeMockUser = (): Partial<User> => ({
    id: 'user-uuid-1',
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
    verificationStatus: VerificationStatus.VERIFIED,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(Wallet), useFactory: mockWalletRepo },
        { provide: getRepositoryToken(AuditLog), useFactory: mockAuditRepo },
        { provide: DataSource, useFactory: mockDataSource },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: SmsService, useFactory: mockSmsService },
        { provide: RedisService, useFactory: mockRedisService },
        { provide: AdminService, useFactory: mockAdminService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    smsService = module.get(SmsService);
    redisService = module.get(RedisService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── requestOtp ─────────────────────────────────────────────────────────────

  describe('requestOtp', () => {
    const dto = { mobileNumber: '+919876543210' };

    it('should throw BadRequestException when rate limit is exceeded', async () => {
      configService.get.mockReturnValue(true); // rate limit enabled
      redisService.get.mockResolvedValue('3'); // already at max

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
      redisService.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(true);

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
      redisService.get.mockResolvedValue('0');
      userRepo.findOne.mockResolvedValue(null);
      userRepo.create.mockReturnValue(makeMockUser());
      userRepo.save.mockResolvedValue(makeMockUser());
      smsService.sendOtp.mockResolvedValue(undefined);

      await service.requestOtp(dto);

      expect(redisService.incr).toHaveBeenCalledWith('otp_rl:9876543210');
      expect(redisService.expire).toHaveBeenCalledWith(
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
        { sub: newUser.id, mobileNumber: '9876543210', type: 'registration' },
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
            mobileNumber: '+919876543210',
            state: 'Maharashtra',
            district: 'Pune',
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
            mobileNumber: '+919876543210',
            state: 'Maharashtra',
            district: 'Pune',
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
          mobileNumber: '+919876543210',
          state: 'Maharashtra',
          district: 'Pune',
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
            mobileNumber: '+919876543210',
            state: 'Maharashtra',
            district: 'Pune',
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
          mobileNumber: '+919876543210',
          state: 'Maharashtra',
          district: 'Pune',
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