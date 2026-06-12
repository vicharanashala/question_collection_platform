import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PayoutMethod, WithdrawalStatus } from '../../common/enums';
import { User } from './user.entity';
import { Wallet } from './wallet.entity';

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

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ name: 'failure_reason', type: 'varchar', length: 500, nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.withdrawalRequests)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Wallet, (wallet) => wallet.withdrawalRequests)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}