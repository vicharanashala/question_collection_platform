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
  @Column({ type: 'varchar', length: 20, nullable: true })
  ifsc: string | null;

  /**
   * For bank: account holder name as per bank records.
   */
  @Column({ name: 'account_holder_name', type: 'varchar', length: 100, nullable: true })
  accountHolderName: string | null;

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
   * Verification status — starts UNVERIFIED, becomes VERIFIED or FAILED.
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
   * The PineLabs order ID used for the verification micro-transaction.
   */
  @Column({ name: 'verification_order_id', type: 'varchar', length: 100, nullable: true, unique: true })
  verificationOrderId: string | null;

  /**
   * Reference to the withdrawal request that triggered this verification (if any).
   * Used to link verification → withdrawal flow.
   */
  @Column({ name: 'withdrawal_request_id', type: 'uuid', nullable: true })
  withdrawalRequestId: string | null;

  @Column({ name: 'verification_failed_reason', type: 'varchar', length: 500, nullable: true })
  verificationFailedReason: string | null;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}