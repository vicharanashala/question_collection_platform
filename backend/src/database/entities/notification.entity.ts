import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  QUESTION_APPROVED = 'question_approved',
  QUESTION_REJECTED = 'question_rejected',
  QUESTION_HELD = 'question_held',
  QUESTION_INFO_REQUESTED = 'question_info_requested',
  REWARD_CREDITED = 'reward_credited',
  WITHDRAWAL_APPROVED = 'withdrawal_approved',
  WITHDRAWAL_REJECTED = 'withdrawal_rejected',
  ACCOUNT_SUSPENDED = 'account_suspended',
  ACCOUNT_BANNED = 'account_banned',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index('idx_notifications_user_id')
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  @Index('idx_notifications_type')
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  body: string;

  /** JSON payload for deep-link / navigation data */
  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  @Index('idx_notifications_is_read')
  isRead: boolean;

  @ManyToOne(() => User, (user) => user.notifications)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}