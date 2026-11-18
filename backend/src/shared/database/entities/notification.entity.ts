import { User } from './user.entity';
import { NotificationType, NotificationTriggerType } from '../../classes/enums';

export { NotificationType, NotificationTriggerType };

export interface Notification {
  id: string;

  userId: string;

  type: NotificationType;

  /** Broad category of what triggered this notification — 'question' or 'withdraw'. */
  triggerType: NotificationTriggerType;

  title: string;

  body: string;

  /** JSON payload for deep-link / navigation data */
  data: Record<string, unknown> | null;

  isRead: boolean;

  user: User;

  createdAt: Date;
}