import { ClientSession } from 'mongoose';
import { BaseRepository } from '../abstractions/base.repository';
// import { Wallet } from '../entities';
import { Wallet } from '../mongodb/schemas/wallet.schema';

export interface WalletFilter {
  id?: string;
  userId?: string;
  balance?: number;
}

export interface WalletAdminSummary {
  totalBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
}

export interface WalletAdminSummaryFilter {
  userId?: string;
  /** Conditions a wallet's owner (user document) must match; wallets without a matching owner are excluded. */
  ownerFilter: Record<string, unknown>;
}

export interface IWalletRepository extends BaseRepository<Wallet> {
  findByUserId(userId: string): Promise<Wallet | null>;
  updateBalance(walletId: string, newBalance: number): Promise<void>;
  incrementBalance(walletId: string, amount: number, session?: ClientSession): Promise<number>;
  decrement(filter: Record<string, unknown>, field: string, amount: number, session?: ClientSession): Promise<void>;
  getTotalBalance(): Promise<number>;
  getAdminSummary(filter: WalletAdminSummaryFilter): Promise<WalletAdminSummary>;
}