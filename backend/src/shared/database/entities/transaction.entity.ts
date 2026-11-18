import { TransactionType, TransactionSource, TransactionStatus } from '../../classes/enums';
import { Wallet } from './wallet.entity';

export interface Transaction {
  id: string;

  walletId: string;

  type: TransactionType;

  source: TransactionSource;

  amount: number;

  balanceAfter: number;

  referenceId: string | null;

  description: string | null;

  rejectionReason: string | null;

  status: TransactionStatus;

  createdAt: Date;

  wallet: Wallet;
}