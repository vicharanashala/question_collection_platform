import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, AuthResponse } from './auth.service';
import { RequestOtpDto, VerifyOtpDto, RegisterDto } from './dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; mobileNumber: string; role: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/request-otp
   * Rate-limited: 3 OTP requests per 15-minute window per mobile number.
   */
  @Public()
  @Post('request-otp')
  @Throttle({ default: { limit: 3, ttl: 900_000 } }) // 3 per 15 min
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  /**
   * POST /auth/verify-otp
   * Returns auth tokens for registered users, or a temp token for new users
   * who still need to complete registration.
   */
  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.mobileNumber, dto);
  }

  /**
   * POST /auth/register
   * Complete new-user registration. Requires a valid registration temp token
   * returned from verify-otp on first login.
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    // Normalize: strip country code and leading zeros so the lookup matches
    // what was stored during the OTP request/verify flow.
    const mobileNumber = this.authService.normalizePhone(dto.mobileNumber);
    const user = await this.authService.findUserByMobile(mobileNumber);
    if (!user) {
      throw new UnauthorizedException(
        'No OTP-verified account found for this mobile number. Please request OTP first.',
      );
    }
    return this.authService.register(dto, user.id);
  }

  /**
   * POST /auth/refresh
   * Exchange a valid refresh token for a new access token.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('refreshToken is required');
    }
    return this.authService.refreshTokens(refreshToken);
  }

  /**
   * GET /auth/me
   * Return the authenticated user's public profile.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.authService.getProfile(req.user.id);
    console.log(`[DEBUG /auth/me] userId=${req.user.id} orgState=${(user as any).organizationState} orgDistrict=${(user as any).organizationDistrict}`);
    return { user };
  }

  /**
   * POST /auth/logout
   * Invalidates the current session by incrementing tokenVersion.
   * All previously issued tokens become invalid instantly.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: AuthenticatedRequest) {
    await this.authService.incrementTokenVersion(req.user.id);
    return { message: 'Logged out successfully' };
  }
}

