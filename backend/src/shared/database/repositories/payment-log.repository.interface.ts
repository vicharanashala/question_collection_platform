import { BaseRepository } from '../abstractions/base.repository';
// import { PaymentLog } from '../entities';
import { PaymentLog } from '../mongodb/schemas/payment-log.schema';
export interface IPaymentLogRepository extends BaseRepository<PaymentLog> {
  findByWithdrawalRequestId(withdrawalRequestId: string): Promise<PaymentLog[]>;
}