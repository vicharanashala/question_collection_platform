import { BaseRepository } from '../abstractions/base.repository';
import { Transaction } from '../entities';

export type TransactionType = 'CREDIT' | 'DEBIT' | 'REFUND';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface TransactionFilter {
  id?: string;
  walletId?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  referenceId?: string;
  createdAt?: Date;
}
export interface RewardTransactionSummary {
  totalRewarded: number;
  rewardCount: number;
  avgReward: number;
}

export interface RewardAnalyticsResult extends RewardTransactionSummary {
  /** All-time completed reward total, ignoring the date window. */
  totalPool: number;
  dailyRewardTrend: Array<{ date: string; amount: number; count: number }>;
}

export interface ITransactionRepository extends BaseRepository<Transaction> {
  getRewardAnalytics(from: Date, to: Date, state?: string): Promise<RewardAnalyticsResult>;
  findByWalletId(walletId: string, limit?: number): Promise<Transaction[]>;
  findByReferenceId(referenceId: string): Promise<Transaction | null>;
  getRewardSummary(
  from: Date,
  to: Date,
  state?: string,
): Promise<RewardTransactionSummary>;
}