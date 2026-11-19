import { ClientSession } from 'mongoose';
import { BaseRepository } from '../abstractions/base.repository';
// import { Wallet } from '../entities';
import { Wallet } from '../mongodb/schemas/wallet.schema';
import type { TesterFilter } from '../../utils/tester.util';
import type { AnveshanScope } from '../../utils/anveshan-mode.util';

export interface WalletFilter {
  id?: string;
  userId?: string;
  balance?: number;
}

/** Which wallets the staff wallet list and its totals cover. Wallets of deleted or missing users are always left out. */
export interface AdminWalletScope {
  userId?: string;
  /** Case-insensitive match on the owner's name or mobile number. */
  search?: string;
  state?: string;
  tester?: TesterFilter;
  anveshanScope?: AnveshanScope;
}

export interface AdminWalletPageOptions {
  page: number;
  limit: number;
  sortBy: 'balance' | 'createdAt';
  sortOrder: 'ASC' | 'DESC';
}

export interface AdminWalletRow {
  id: string;
  userId: string;
  balance: number;
  /** Completed reward credits. */
  totalEarned: number;
  /** Completed withdrawal debits. */
  totalWithdrawn: number;
  owner: {
    id: string;
    name: string;
    mobileNumber: string | null;
    state: string;
    district: string | null;
    category: string | null;
    role: string;
    verificationStatus: string;
    createdAt: Date;
    isTester: boolean;
  };
}

export interface AdminWalletTotals {
  totalWallets: number;
  totalBalance: number;
  totalDistributed: number;
  totalWithdrawn: number;
}

export interface IWalletRepository extends BaseRepository<Wallet> {
  findByUserId(userId: string): Promise<Wallet | null>;
  updateBalance(walletId: string, newBalance: number): Promise<void>;
  incrementBalance(walletId: string, amount: number, session?: ClientSession): Promise<number>;
  decrement(filter: Record<string, unknown>, field: string, amount: number, session?: ClientSession): Promise<void>;
  getTotalBalance(): Promise<number>;
  /** One page of wallets in scope, with owner details and transaction totals, plus the count of all wallets in scope. */
  findAdminPage(scope: AdminWalletScope, options: AdminWalletPageOptions): Promise<{ items: AdminWalletRow[]; total: number }>;
  /** Count and money totals across every wallet in scope. */
  getAdminTotals(scope: AdminWalletScope): Promise<AdminWalletTotals>;
}