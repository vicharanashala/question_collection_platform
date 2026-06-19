import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PaymentLogStatus } from '../../common/enums';
import { WithdrawalRequest } from './withdrawal-request.entity';

@Entity('payment_logs')
export class PaymentLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The withdrawal request this log belongs to */
  @Column({ name: 'withdrawal_request_id', type: 'uuid' })
  @Index('idx_payment_logs_withdrawal_id')
  withdrawalRequestId: string;

  /** Admin who initiated the payment attempt */
  @Column({ name: 'admin_id', type: 'uuid', nullable: true })
  adminId: string | null;

  /** PineLabs order ID (used as idempotency key) */
  @Column({ name: 'order_id', type: 'varchar', length: 100 })
  orderId: string;

  /** PineLabs transaction ID returned by the API */
  @Column({ name: 'pinelabs_transaction_id', type: 'varchar', length: 100, nullable: true })
  pinelabsTransactionId: string | null;

  @Column({ type: 'varchar', length: 20 })
  status: PaymentLogStatus;

  /** Error code from PineLabs (if failed) */
  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true })
  errorCode: string | null;

  /** Error message from PineLabs (if failed) */
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  /** Raw response from PineLabs (for debugging) */
  @Column({ name: 'raw_response', type: 'jsonb', nullable: true })
  rawResponse: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'attempted_at' })
  attemptedAt: Date;

  @ManyToOne(() => WithdrawalRequest, (wr) => wr.paymentLogs)
  @JoinColumn({ name: 'withdrawal_request_id' })
  withdrawalRequest: WithdrawalRequest;
}