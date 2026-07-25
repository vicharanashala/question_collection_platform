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

export interface ITransactionRepository extends BaseRepository<Transaction> {
  findByWalletId(walletId: string, limit?: number): Promise<Transaction[]>;
  findByReferenceId(referenceId: string): Promise<Transaction | null>;
}