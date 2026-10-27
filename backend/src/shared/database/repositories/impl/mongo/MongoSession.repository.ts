import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Session } from "@/shared/database/mongodb/schemas/session.schema";
import { MongoRepository } from "@/shared/database/abstractions/mongo.repository";
import { ISessionRepository } from "../../ISeession.repository";
import { SessionMeta } from "@/modules/session/session.service";

@Injectable()
export class MongoSessionRepository
  extends MongoRepository<Session>
  implements ISessionRepository
{
  constructor(
    @InjectModel("Session") protected readonly _model: Model<Session>,
  ) {
    super(_model);
  }

  // Login: create or replace the user's single session
  async upsertForUser(data: {
    userId: string;
    sessionId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    meta?: SessionMeta;
  }): Promise<void> {
    const { userId, sessionId, refreshTokenHash, expiresAt, meta } = data;
    const doUpsert = () =>
      this._model
        .updateOne(
          { userId },
          {
            $set: {
              sessionId,
              refreshTokenHash,
              expiresAt,
              lastActivityAt: new Date(),
              // set every field explicitly so details of the previous device don't linger
              userAgent: meta?.userAgent ?? null,
              browser: meta?.browser ?? null,
              os: meta?.os ?? null,
              device: meta?.device ?? null,
              ipAddress: meta?.ipAddress ?? null,
            },
          },
          { upsert: true },
        )
        .exec();

    try {
      await doUpsert();
    } catch (err: any) {
      // two simultaneous first logins can race on the unique userId index; retry once
      if (err?.code === 11000) await doUpsert();
      else throw err;
    }
  }

  async findActiveBySessionId(
    sessionId: string,
    userId: string,
  ): Promise<Session | null> {
    return this._model
      .findOne({ sessionId, userId, expiresAt: { $gt: new Date() } })
      .lean<Session>()
      .exec();
  }

  async findActiveWithRefreshHash(
    sessionId: string,
    userId: string,
  ): Promise<Session | null> {
    return this._model
      .findOne({ sessionId, userId, expiresAt: { $gt: new Date() } })
      .select("+refreshTokenHash")
      .lean<Session>()
      .exec();
  }

  async touchActivity(sessionId: string): Promise<void> {
    await this._model
      .updateOne({ sessionId }, { $set: { lastActivityAt: new Date() } })
      .exec();
  }

  // Normal logout: only deletes if the sid still matches the user's current session
  async deleteBySessionId(sessionId: string, userId: string): Promise<number> {
    const res = await this._model.deleteOne({ sessionId, userId }).exec();
    return res.deletedCount;
  }

  // Super Admin remote logout
  async deleteByUserId(userId: string): Promise<number> {
    const res = await this._model.deleteOne({ userId }).exec();
    return res.deletedCount;
  }

  async listActiveSessions(filter: {
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const { userId, page = 1, limit = 20 } = filter;
    const q = {
      expiresAt: { $gt: new Date() },
      ...(userId && { userId }),
    };
    const [items, total] = await Promise.all([
      this._model
        .find(q)
        .sort({ lastActivityAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<Session[]>()
        .exec(),
      this._model.countDocuments(q).exec(),
    ]);
    return { items, total, page, limit };
  }

  async findActiveByUserIds(userIds: string[]) {
  if (!userIds.length) return [];
  return this._model
    .find({ userId: { $in: userIds }, expiresAt: { $gt: new Date() } })
    .select("userId lastActivityAt browser os device")
    .lean<Session[]>()
    .exec();
}

}
