import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserCategory } from '../common/enums';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; mobileNumber: string; role: string };
}

const mockAuthService = () => ({
  requestOtp: jest.fn(),
  verifyOtp: jest.fn(),
  register: jest.fn(),
  refreshTokens: jest.fn(),
  getProfile: jest.fn(),
  findUserByMobile: jest.fn(),
  normalizePhone: jest.fn((n: string) => n.replace(/^\+91/, '')),
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof mockAuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', limit: 10, ttl: 60_000 }]),
      ],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useFactory: mockAuthService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── POST /auth/request-otp ─────────────────────────────────────────────────

  describe('POST /auth/request-otp', () => {
    it('should call authService.requestOtp with the mobile number', async () => {
      authService.requestOtp.mockResolvedValue({ message: 'OTP sent successfully' });

      const result = await controller.requestOtp({ mobileNumber: '+919876543210' });

      expect(authService.requestOtp).toHaveBeenCalledWith({ mobileNumber: '+919876543210' });
      expect(result).toEqual({ message: 'OTP sent successfully' });
    });
  });

  // ─── POST /auth/verify-otp ──────────────────────────────────────────────────

  describe('POST /auth/verify-otp', () => {
    it('should call authService.verifyOtp with dto', async () => {
      const dto = { mobileNumber: '+919876543210', otp: '123456' };
      authService.verifyOtp.mockResolvedValue({
        requiresRegistration: false,
        user: { id: 'user-1', name: 'Ramesh' },
        tokens: { accessToken: 'at', refreshToken: 'rt', expiresIn: 900 },
      });

      const result = await controller.verifyOtp(dto);

      expect(authService.verifyOtp).toHaveBeenCalledWith('+919876543210', dto);
      expect(result).toHaveProperty('tokens');
    });
  });

  // ─── POST /auth/register ────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    const registerDto = {
      name: 'Ramesh Kumar',
      mobileNumber: '+919876543210',
      state: 'Maharashtra',
      district: 'Pune',
      block: 'Haveli',
      village: 'Hadapsar',
      category: UserCategory.FARMER,
      languagePreference: 'hi',
      consentGiven: true,
    };

    it('should throw UnauthorizedException when user not found by mobile', async () => {
      authService.findUserByMobile.mockResolvedValue(null);

      await expect(controller.register(registerDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should call authService.register when user is found', async () => {
      authService.findUserByMobile.mockResolvedValue({ id: 'user-1' });
      authService.register.mockResolvedValue({
        tokens: { accessToken: 'at', refreshToken: 'rt', expiresIn: 900 },
        user: { id: 'user-1', name: 'Ramesh Kumar' },
      });

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto, 'user-1');
      expect(result).toHaveProperty('tokens');
    });
  });

  // ─── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('should throw BadRequestException when refreshToken is missing', async () => {
      await expect(controller.refresh('')).rejects.toThrow(BadRequestException);
      await expect(controller.refresh(null as unknown as string)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should call authService.refreshTokens with the token', async () => {
      authService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 900,
      });

      const result = await controller.refresh('some-refresh-token');

      expect(authService.refreshTokens).toHaveBeenCalledWith('some-refresh-token');
      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        expiresIn: 900,
      });
    });
  });

  // ─── GET /auth/me ───────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('should return the authenticated user profile', async () => {
      const mockUser = { id: 'user-1', name: 'Ramesh', mobileNumber: '+919876543210' };
      authService.getProfile.mockResolvedValue(mockUser);

      // Simulate authenticated request via the mock guard
      const mockReq = { user: { id: 'user-1' } } as unknown as AuthenticatedRequest;

      const result = await controller.me(mockReq);

      expect(authService.getProfile).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ user: mockUser });
    });
  });
});