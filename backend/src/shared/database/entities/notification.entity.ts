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
import { NotificationType, NotificationTriggerType } from '../../classes/enums';

export { NotificationType, NotificationTriggerType };

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