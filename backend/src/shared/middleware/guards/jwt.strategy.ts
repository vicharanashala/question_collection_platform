import { Injectable, UnauthorizedException, Inject } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { VerificationStatus } from "../../classes/enums";
import { UserAccountLockedException } from "../../classes/exceptions/user-status.exception";
import { IUserRepository } from "../../../shared/database/repositories/IUser.repository";
import { REPOSITORY_TOKENS } from "../../../shared/database/repositories";
import { User } from "@/shared/database/mongodb/schemas/user.schema";
import { Types } from "mongoose";
import { SessionService } from "@/modules/session/session.service";

export interface JwtPayload {
  sub: string;
  mobileNumber: string;
  role: string;
  tokenVersion: number;
  sid?: string;
  type?: "access" | "refresh" | "registration";
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,

     private readonly sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>("jwt.secret") ?? "change-me-in-production",
    });
  }

  /**
   * Passport invokes this after decoding the JWT.
   * Return value becomes `request.user`.
   */
async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.mobileNumber) {
      throw new UnauthorizedException("Invalid token payload");
    }
    if (!Types.ObjectId.isValid(payload.sub)) {
      throw new UnauthorizedException("Invalid token payload");
    }

      if (payload.type !== "access" || !payload.sid) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: "SESSION_REVOKED",
        message: "Your session has ended. Please log in again.",
      });
    }

    // Token signature and expiry are already verified by Passport.
    // Now verify the user still exists in the DB.
    const user = await this.userRepo.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

 if (user.isDeleted) {
  throw new UnauthorizedException({
    statusCode: 401,
    error: "Unauthorized",
    code: "ACCOUNT_DELETED",
    message: "Account no longer exists",
  });
}

 await this.sessionService.validateAccess(payload.sid, payload.sub);

    // Verify tokenVersion matches — invalidates tokens issued before the last login/logout
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException("Session expired. Please login again.");
    }

    // Auto-reinstate: suspension period has expired
    if (
      user.verificationStatus === VerificationStatus.SUSPENDED &&
      user.suspendedUntil &&
      new Date() > new Date(user.suspendedUntil)
    ) {
      await this.userRepo.update(user._id.toString(), {
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
      sid: payload.sid,
      mobileNumber: payload.mobileNumber,
      role: payload.role,
      verificationStatus: user.verificationStatus,
      suspendedReason: user.suspendedReason,
      suspendedAt: user.suspendedAt,
      suspendedUntil: user.suspendedUntil,
      bannedReason: user.bannedReason,
      bannedAt: user.bannedAt,
      name: user.name,
      isAnveshanUser: user.isAnveshanUser,
    };
  }
}
