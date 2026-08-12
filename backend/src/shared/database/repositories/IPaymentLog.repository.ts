import { BaseRepository } from '../abstractions/base.repository';
import { PaymentLog } from '../entities';

export interface IPaymentLogRepository extends BaseRepository<PaymentLog> {
  findByWithdrawalRequestId(withdrawalRequestId: string): Promise<PaymentLog[]>;
}