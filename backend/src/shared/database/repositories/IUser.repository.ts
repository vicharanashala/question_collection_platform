import { BaseRepository } from '../abstractions/base.repository';
import { User, Wallet, AuditLog } from '../entities';
import {
  UserCategory,
  VerificationStatus,
  UserRole,
  AuditAction,
  ActorType,
} from '../../classes/enums';
import type { Types } from 'mongoose';

/** ─── User entity filter shorthands ──────────────────────────────────────── */
export interface UserFilter {
  id?: string;
  mobileNumber?: string;
  username?: string;
  email?: string;
  verificationStatus?: VerificationStatus;
  role?: UserRole;
  category?: UserCategory;
  state?: string;
  district?: string;
  createdAt?: Date;
}

/** ─── Leaderboard projection ──────────────────────────────────────────────── */
export interface LeaderboardEntry {
  id: string;
  username: string | null;
  name: string;
  mobileNumber: string;
  profilePicUrl: string | null;
  crops: string[];
  approvedCount: number;
  rank?: number;
}

/** ─── IUserRepository ─────────────────────────────────────────────────────── */
export interface IUserRepository extends BaseRepository<User> {
  findByMobile(mobileNumber: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  /**
   * Bulk lookup users by their `users._id` values. Accepts a mixed array of
   * 24-char hex strings and/or `Types.ObjectId` instances; non-24-char / non-
   * string values are silently dropped from the query. Returns users with
   * only the `_id`, `name`, and `username` fields populated (lighter than a
   * full `User`). Intended for read-only display enrichment (e.g. resolving
   * the `distributorId` column on the Distributions list) — callers that
   * need the full user document should use `findById` in a loop or extend
   * this.
   */
  findByIds(
    ids: ReadonlyArray<string | Types.ObjectId | null | undefined>,
  ): Promise<Array<{ id: string; name: string; username: string | null }>>;
  updateOtpHash(mobileNumber: string, hash: string): Promise<void>;
  clearOtpHash(mobileNumber: string): Promise<void>;
  findWithWallet(userId: string): Promise<(User & { wallet?: Wallet }) | null>;
  getLeaderboard(opts: {
    limit?: number;
    skip?: number;
    state?: string;
    category?: UserCategory;
  }): Promise<{ id: string; username: string | null; name: string; mobileNumber: string; profilePicUrl: string | null; crops: string[]; approvedCount: number }[]>;
  getApprovedQuestionCount(userId: string): Promise<number>;
}