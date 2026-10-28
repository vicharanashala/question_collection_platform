import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "crypto";
import { Session } from "@/shared/database/mongodb/schemas/session.schema";
import {
  ISessionRepository,
  REPOSITORY_TOKENS,
} from "@/shared/database/repositories";

type ActiveSessionInfo = Pick<Session, "userId" | "lastActivityAt" | "browser" | "os" | "device">;


export interface SessionMeta {
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: string;
}

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const sessionEnded = () =>
  new UnauthorizedException({
    statusCode: 401,
    code: "SESSION_REVOKED",
    message: "Your session has ended. Please log in again.",
  });

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(REPOSITORY_TOKENS.Session)
    private readonly sessionRepo: ISessionRepository,
  ) {}

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  // Login: creates the user's session, replacing any existing one (one device at a time)
  async create(p: {
    sessionId: string;
    userId: string;
    refreshToken: string;
    expiresAt: Date;
    meta?: SessionMeta;
  }): Promise<void> {
    await this.sessionRepo.upsertForUser({
      sessionId: p.sessionId,
      userId: p.userId,
      refreshTokenHash: this.hashToken(p.refreshToken),
      expiresAt: p.expiresAt,
      meta: p.meta,
    });
  }

  // Called by the JWT strategy on every protected request. Fails closed.
  async validateAccess(sid: string, userId: string): Promise<Session> {
    let session: Session | null;
    try {
      session = await this.sessionRepo.findActiveBySessionId(sid, userId);
    } catch (err) {
      this.logger.error(`Session lookup failed: ${err}`);
      // 503, not 401, so the frontend doesn't wipe auth on a transient DB error
      throw new ServiceUnavailableException("Unable to verify session");
    }

    if (!session) throw sessionEnded();

    if (
      Date.now() - new Date(session.lastActivityAt).getTime() >
      TOUCH_INTERVAL_MS
    ) {
      this.sessionRepo
        .touchActivity(sid)
        .catch((e) => this.logger.warn(`touch failed: ${e}`));
    }
    return session;
  }

  // Called by refreshTokens: also checks the refresh token against the stored hash
  async validateRefresh(
    sid: string,
    userId: string,
    refreshToken: string,
  ): Promise<Session> {
    let session: Session | null;
    try {
      session = await this.sessionRepo.findActiveWithRefreshHash(sid, userId);
    } catch (err) {
      this.logger.error(`Refresh session lookup failed: ${err}`);
      throw new ServiceUnavailableException("Unable to verify session");
    }

    if (!session) throw sessionEnded();

    const expected = Buffer.from(session.refreshTokenHash, "hex");
    const actual = Buffer.from(this.hashToken(refreshToken), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw sessionEnded();
    }
    return session;
  }

  // Normal logout: deletes only if the sid is still the user's current session
  async revoke(sid: string, userId: string): Promise<number> {
    return this.sessionRepo.deleteBySessionId(sid, userId);
  }

  // Super Admin remote logout (also use on ban/suspend)
  async revokeUser(userId: string): Promise<number> {
    return this.sessionRepo.deleteByUserId(userId);
  }

  async listActiveSessions(filter: {
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    return this.sessionRepo.listActiveSessions(filter);
  }

  async getActiveSessionMap(userIds: string[]): Promise<Map<string, ActiveSessionInfo>> {
  try {
    const rows = await this.sessionRepo.findActiveByUserIds(userIds);
    return new Map(rows.map((r) => [r.userId, r]));
  } catch (err) {
    this.logger.warn(`Active session lookup failed: ${err}`);
    return new Map();
  }
}

}


