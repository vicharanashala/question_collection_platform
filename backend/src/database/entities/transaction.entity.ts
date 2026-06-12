import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TransactionType, TransactionSource, TransactionStatus } from '../../common/enums';
import { Wallet } from './wallet.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id', type: 'uuid' })
  @Index('idx_transactions_wallet_id')
  walletId: string;

  @Column({ type: 'varchar', length: 10 })
  type: TransactionType;

  @Column({ type: 'varchar', length: 20 })
  source: TransactionSource;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'balance_after', type: 'decimal', precision: 12, scale: 2 })
  balanceAfter: number;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  @Index('idx_transactions_reference_id')
  referenceId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20 })
  @Index('idx_transactions_status')
  status: TransactionStatus;

  @CreateDateColumn({ name: 'created_at' })
  @Index('idx_transactions_created_at')
  createdAt: Date;

  @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;
}