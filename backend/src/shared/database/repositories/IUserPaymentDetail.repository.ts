import { BaseRepository } from '../abstractions/base.repository';
// import { UserPaymentDetail } from '../entities';
import { UserPaymentDetail } from '../mongodb/schemas/user-payment-detail.schema';
export interface IUserPaymentDetailRepository extends BaseRepository<UserPaymentDetail> {
  findByUserId(userId: string): Promise<UserPaymentDetail | null>;
  findByRazorpayValidationId(validationId: string): Promise<UserPaymentDetail | null>;
  findLatestVerifiedByUserId(userId: string): Promise<any>
}