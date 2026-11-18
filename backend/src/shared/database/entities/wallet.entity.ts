import { User } from './user.entity';
import { Transaction } from './transaction.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';

export interface Wallet {
  id: string;

  userId: string;

  balance: number;

  currency: string;

  createdAt: Date;

  updatedAt: Date;

  user: User;

  transactions: Transaction[];

  withdrawalRequests: WithdrawalRequest[];
}