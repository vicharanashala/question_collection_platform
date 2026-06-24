import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { PayoutMethod, WithdrawalStatus } from '../../common/enums';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';
import { PaymentLog } from './payment-log.entity';

@Entity('withdrawal_requests')
export class WithdrawalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index('idx_withdrawals_user_id')
  userId: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'payout_method', type: 'varchar', length: 20 })
  payoutMethod: PayoutMethod;

  @Column({ name: 'payout_details', type: 'jsonb' })
  payoutDetails: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20 })
  @Index('idx_withdrawals_status')
  status: WithdrawalStatus;

  // PineLabs fields
  @Column({ name: 'pinelabs_transaction_id', type: 'varchar', length: 100, nullable: true })
  pinelabsTransactionId: string | null;

  @Column({ name: 'order_id', type: 'varchar', length: 100, nullable: true, unique: true })
  orderId: string | null;

  /** Razorpay payout ID set after initiating a Razorpay payout */
  @Column({ name: 'razorpay_payout_id', type: 'varchar', length: 100, nullable: true })
  razorpayPayoutId: string | null;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  /** Human-readable reason set when a withdrawal fails or is reversed (e.g. bank rejected, payout reversed) */
  @Column({ name: 'failure_reason', type: 'varchar', length: 500, nullable: true })
  failureReason: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.withdrawalRequests)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Wallet, (wallet) => wallet.withdrawalRequests)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @OneToMany(() => PaymentLog, (pl) => pl.withdrawalRequest)
  paymentLogs: PaymentLog[];
}