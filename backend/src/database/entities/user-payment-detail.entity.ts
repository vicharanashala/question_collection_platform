import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PayoutMethod } from '../../common/enums';

@Entity('user_payment_details')
export class UserPaymentDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index('idx_upd_user_id')
  userId: string;

  @Column({ name: 'payout_method', type: 'varchar', length: 20 })
  payoutMethod: PayoutMethod;

  /**
   * For UPI: the UPI ID string (e.g. "user@upi").
   * Stored in plain text for display purposes only — never logged or exposed
   * beyond the owning user and admin users.
   */
  @Column({ name: 'upi_id', type: 'varchar', length: 100, nullable: true })
  upiId: string | null;

  /**
   * For bank: last 4 digits only — stored for display so user recognises the account.
   */
  @Column({ name: 'account_number_last4', type: 'varchar', length: 4, nullable: true })
  accountNumberLast4: string | null;

  /**
   * For bank: IFSC code.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  ifsc: string | null;

  @Column({ name: 'ifsc_encrypted', type: 'varchar', length: 500, nullable: true })
  ifscEncrypted: string | null;

  /**
   * For bank: account holder name as per bank records.
   */
  @Column({ name: 'account_holder_name', type: 'varchar', length: 500, nullable: true })
  accountHolderName: string | null;

  @Column({ name: 'account_holder_name_encrypted', type: 'varchar', length: 500, nullable: true })
  accountHolderNameEncrypted: string | null;

  /**
   * For bank: bank name looked up from IFSC (can be pre-filled or edited by user).
   * Stored in plain text for display.
   */
  @Column({ name: 'bank_name', type: 'varchar', length: 200, nullable: true })
  bankName: string | null;

  /**
   * The full account number stored encrypted.
   * Only decrypted in-memory when dispatching payouts; never logged or returned in APIs.
   */
  @Column({ name: 'account_number_encrypted', type: 'varchar', length: 500, nullable: true })
  accountNumberEncrypted: string | null;

  /**
   * Verification status — starts pending, becomes verified or failed.
   */
  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  @Index('idx_upd_status')
  status: 'pending' | 'in_progress' | 'verified' | 'failed';

  /**
   * The PineLabs order ID used for the verification micro-transaction (deprecated).
   */
  @Column({ name: 'verification_order_id', type: 'varchar', length: 100, nullable: true, unique: true })
  verificationOrderId: string | null;

  /**
   * Reference to the withdrawal request that triggered this verification (if any).
   * Used to link verification -> withdrawal flow.
   */
  @Column({ name: 'withdrawal_request_id', type: 'uuid', nullable: true })
  withdrawalRequestId: string | null;

  @Column({ name: 'verification_failed_reason', type: 'varchar', length: 500, nullable: true })
  verificationFailedReason: string | null;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  /** Razorpay fund_account ID — created once per user, reused for all future payouts */
  @Column({ name: 'razorpay_fund_account_id', type: 'varchar', length: 100, nullable: true })
  razorpayFundAccountId: string | null;

  /** Razorpay payout ID for the most recent payout */
  @Column({ name: 'razorpay_payout_id', type: 'varchar', length: 100, nullable: true })
  razorpayPayoutId: string | null;

  /** Razorpay payment link ID for the latest verification collection (deprecated — use fund account validation) */
  @Column({ name: 'razorpay_payment_link_id', type: 'varchar', length: 100, nullable: true })
  razorpayPaymentLinkId: string | null;

  /** Razorpay payment link short URL sent to the user (deprecated — use fund account validation) */
  @Column({ name: 'razorpay_payment_link_url', type: 'varchar', length: 500, nullable: true })
  razorpayPaymentLinkUrl: string | null;

  /**
   * Razorpay fund account validation ID (fav_xxx).
   * Returned when POST /v1/fund_accounts/validations is called to verify
   * the payment detail. Correlates fund_account.validated / fund_account.validation_failed
   * webhook events to this record.
   */
  @Column({ name: 'razorpay_validation_id', type: 'varchar', length: 100, nullable: true })
  razorpayValidationId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}