// import { MongoRepository } from "typeorm";
import { Session } from "../mongodb/schemas/session.schema";
import { MongoRepository } from "../abstractions/mongo.repository";
import { SessionMeta } from "@/modules/session/session.service";

export interface ISessionRepository extends MongoRepository<Session> {
  // NEW: login creates or replaces the user's single session
  upsertForUser(data: {
    userId: string;
    sessionId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    meta?: SessionMeta;
  }): Promise<void>;

  findActiveBySessionId(sessionId: string, userId: string): Promise<Session | null>;
  findActiveWithRefreshHash(sessionId: string, userId: string): Promise<Session | null>;
  touchActivity(sessionId: string): Promise<void>;

  // RENAMED + changed: revoke now deletes the document
  deleteBySessionId(sessionId: string, userId: string): Promise<number>; // normal logout
  deleteByUserId(userId: string): Promise<number>; // Super Admin remote logout

  // RENAMED (typo fix, and they are sessions, not users)
  listActiveSessions(filter: { page?: number; limit?: number; userId?: string }): Promise<{
    items: Session[];
    total: number;
    page: number;
    limit: number;
  }>;

  findActiveByUserIds(userIds: string[]): Promise<
  Pick<Session, "userId" | "lastActivityAt" | "browser" | "os" | "device">[]
>;
}