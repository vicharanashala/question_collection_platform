import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Transaction } from './transaction.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  @Index('idx_wallets_user_id')
  userId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.wallet)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Transaction, (tx) => tx.wallet)
  transactions: Transaction[];

  @OneToMany(() => WithdrawalRequest, (wr) => wr.wallet)
  withdrawalRequests: WithdrawalRequest[];
}