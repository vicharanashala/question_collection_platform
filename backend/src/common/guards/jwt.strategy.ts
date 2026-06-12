import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  mobileNumber: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
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
    // We trust the payload — userId is embedded as `sub`.
    return {
      id: payload.sub,
      mobileNumber: payload.mobileNumber,
      role: payload.role,
    };
  }
}