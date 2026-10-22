import { BaseRepository } from '../abstractions/base.repository';
// import { Transaction } from '../entities';
import { Transaction } from '../mongodb/schemas/transaction.schema';
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



export interface WalletTransactionSummary {
  totalCount: number;
  totalCredits: number;
  totalDebits: number;
  completedCredits: number;
  completedDebits: number;
  /** Transactions whose source is 'withdrawal'. */
  withdrawalCount: number;
}

  export interface TransactionListOptions {
  type?: string;
  status?: string;
  source?: string;
  fromDate?: Date;
  toDate?: Date;
  sortBy?: 'amount' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
  select?: string;
}


export interface RewardAnalyticsResult extends RewardTransactionSummary {
  /** All-time completed reward total, ignoring the date window. */
  totalPool: number;
  dailyRewardTrend: Array<{ date: string; amount: number; count: number }>;
}

export interface TransactionBySourceOptions {
  fromDate: Date;
  toDate: Date;
  walletIds?: string[]; // restrict to these wallets (used for the state filter)
  limit?: number;
  select?: string;
}

export interface ITransactionRepository extends BaseRepository<Transaction> {
  getRewardAnalytics(from: Date, to: Date, state?: string): Promise<RewardAnalyticsResult>;
  findByWalletId(walletId: string, limit?: number): Promise<Transaction[]>;
  findByReferenceId(referenceId: string): Promise<Transaction | null>;
  /** Credit/debit totals across every transaction of one wallet. */
  getWalletSummary(walletId: string): Promise<WalletTransactionSummary>;
  getRewardSummary(
  from: Date,
  to: Date,
  state?: string,
): Promise<RewardTransactionSummary>;

  /** Reward transactions (joined with user name/mobile) for CSV/Excel export. */
  findRewardsForExport(filters: { from: Date; to: Date; state?: string }): Promise<Record<string, unknown>[]>;

findPaginatedByWalletId(
  walletId: string,
  page: number,
  limit: number,
  options?: TransactionListOptions,
): Promise<{ items: Transaction[]; total: number }>;

getEarnedAndWithdrawn(
  walletId: string,
): Promise<{ totalEarned: number; totalWithdrawn: number }>;

findBySource(
  source: string,
  options: TransactionBySourceOptions,
): Promise<Transaction[]>;

}
