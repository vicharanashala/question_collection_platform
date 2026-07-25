import { BaseRepository } from '../abstractions/base.repository';
import { UserPaymentDetail } from '../entities';

export interface IUserPaymentDetailRepository extends BaseRepository<UserPaymentDetail> {
  findByUserId(userId: string): Promise<UserPaymentDetail | null>;
  findByRazorpayValidationId(validationId: string): Promise<UserPaymentDetail | null>;
}