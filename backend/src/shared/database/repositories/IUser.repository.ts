import { BaseRepository } from '../abstractions/base.repository';
import { User, Wallet, AuditLog } from '../entities';
import {
  UserCategory,
  VerificationStatus,
  UserRole,
  AuditAction,
  ActorType,
} from '../../classes/enums';

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