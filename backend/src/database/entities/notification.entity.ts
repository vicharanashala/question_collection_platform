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
  DUPLICATE_QUESTION = 'duplicate_question',
  REWARD_CREDITED = 'reward_credited',
  WITHDRAWAL_APPROVED = 'withdrawal_approved',
  WITHDRAWAL_REJECTED = 'withdrawal_rejected',
  WITHDRAWAL_FAILED = 'withdrawal_failed',
  REFUND_COMPLETED = 'refund_completed',
  ACCOUNT_SUSPENDED = 'account_suspended',
  ACCOUNT_BANNED = 'account_banned',
  GENERAL = 'general',
  REPORT_REPLY = 'report_reply',
}

export enum NotificationTriggerType {
  /** Notification triggered by a question action (submit, approve, reject, hold, etc.) */
  QUESTION = 'question',
  /** Notification triggered by a withdrawal request action */
  WITHDRAW = 'withdraw',
  /** System-generated notification (e.g. payment failure alert) */
  SYSTEM = 'system',
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

  /** Broad category of what triggered this notification — 'question' or 'withdraw'. */
  @Column({
    name: 'trigger_type',
    type: 'varchar',
    length: 20,
    default: NotificationTriggerType.QUESTION,
  })
  @Index('idx_notifications_trigger_type')
  triggerType: NotificationTriggerType;

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