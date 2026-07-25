import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../database/entities';
import { VerificationStatus } from '../../classes/enums';
import { UserAccountLockedException } from '../../classes/exceptions/user-status.exception';
import { IUserRepository } from '../../../shared/database/repositories/IUser.repository';
import { REPOSITORY_TOKENS } from '../../../shared/database/repositories';

export interface JwtPayload {
  sub: string;
  mobileNumber: string;
  role: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') ?? 'change-me-in-production',
    });
  }

  /**
   * Passport invokes this after decoding the JWT.
   * Return value becomes `request.user`.
   */
  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.mobileNumber) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Token signature and expiry are already verified by Passport.
    // Now verify the user still exists in the DB.
    const user = await this.userRepo.findOne({ id: payload.sub });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify tokenVersion matches — invalidates tokens issued before the last login/logout
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

    // Return user object including verificationStatus. Do NOT throw lock exceptions
    // here — passport-jwt would intercept them as 401. Instead, throw them from
    // JwtAuthGuard.handleRequest where NestJS controls the HTTP status code.
    return {
      id: payload.sub,
      mobileNumber: payload.mobileNumber,
      role: payload.role,
      verificationStatus: user.verificationStatus,
      suspendedReason: user.suspendedReason,
      suspendedAt: user.suspendedAt,
      suspendedUntil: user.suspendedUntil,
      bannedReason: user.bannedReason,
      bannedAt: user.bannedAt,
    };
  }
}