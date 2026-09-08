import { BaseRepository } from '../abstractions/base.repository';
import { WithdrawalRequest } from '../entities';
import { WithdrawalStatus } from '../../classes/enums';

export interface WithdrawalRequestFilter {
  id?: string;
  userId?: string;
  walletId?: string;
  status?: WithdrawalStatus;
  payoutMethod?: string;
}

export interface WithdrawalFinancialSummary {
  totalPaidOut: number;

  pendingWithdrawals: {
    count: number;
    amount: number;
  };

  completedWithdrawals: {
    count: number;
    amount: number;
  };

  failedWithdrawals: {
    count: number;
  };

  today: {
    payoutCount: number;
    payoutAmount: number;
  };

  dailyPayoutTrend: Array<{
    date: string;
    count: number;
    amount: number;
  }>;
}

export interface WithdrawalRewardSummary {
  totalWithdrawn: number;
  withdrawalCount: number;
  pendingWithdrawals: number;
}

export interface ListWithdrawalsOptions {
  page: number;
  limit: number;
  status?: string;
  state?: string;
  search?: string;
  sortBy?: 'createdAt' | 'amount' | 'processedAt';
  sortOrder?: 'ASC' | 'DESC';
  fromDate?: Date;
  toDate?: Date;
  filterStatus?: string;
}

export interface WithdrawalListItem {
  id: string;
  amount: number;
  payoutMethod: string;
  payoutDetails: unknown;
  status: string;
  createdAt: Date;
  processedAt?: Date | null;
  pinelabsTransactionId?: string | null;
  orderId?: string | null;
  rejectionReason?: string | null;
  user?: {
    id: string;
    name: string;
    mobileNumber: string;
    state: string;
  } | null;
}

export interface ListWithdrawalsResult {
  items: WithdrawalListItem[];
  total: number;
}

export interface IWithdrawalRequestRepository extends BaseRepository<WithdrawalRequest> {
  findPendingByUserId(userId: string): Promise<WithdrawalRequest | null>;
  findByWalletId(walletId: string): Promise<WithdrawalRequest[]>;
  findByStatus(status: WithdrawalStatus): Promise<WithdrawalRequest[]>;

  getFinancialSummary(
  since: Date,
  todayStart: Date,
  now: Date,
): Promise<WithdrawalFinancialSummary>;

getRewardSummary(
  from: Date,
  to: Date,
): Promise<WithdrawalRewardSummary>;

listWithdrawals(
  options: ListWithdrawalsOptions,
): Promise<ListWithdrawalsResult>;
}