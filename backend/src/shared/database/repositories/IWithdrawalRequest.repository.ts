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

export interface IWithdrawalRequestRepository extends BaseRepository<WithdrawalRequest> {
  findPendingByUserId(userId: string): Promise<WithdrawalRequest | null>;
  findByWalletId(walletId: string): Promise<WithdrawalRequest[]>;
  findByStatus(status: WithdrawalStatus): Promise<WithdrawalRequest[]>;
}