import { ClientSession } from 'mongoose';
import { BaseRepository } from '../abstractions/base.repository';
import { Wallet } from '../entities';

export interface WalletFilter {
  id?: string;
  userId?: string;
  balance?: number;
}

export interface IWalletRepository extends BaseRepository<Wallet> {
  findByUserId(userId: string): Promise<Wallet | null>;
  updateBalance(walletId: string, newBalance: number): Promise<void>;
  incrementBalance(walletId: string, amount: number, session?: ClientSession): Promise<number>;
  decrement(filter: Record<string, unknown>, field: string, amount: number, session?: ClientSession): Promise<void>;
}