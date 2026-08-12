import { BaseRepository } from '../abstractions/base.repository';
import { Notification } from '../entities';
import { NotificationType, NotificationTriggerType } from '../../classes/enums';

export interface NotificationFilter {
  id?: string;
  userId?: string;
  type?: NotificationType;
  triggerType?: NotificationTriggerType;
  isRead?: boolean;
  createdAt?: Date;
}

export interface INotificationRepository extends BaseRepository<Notification> {
  findByUserId(userId: string, limit?: number): Promise<Notification[]>;
  markAllRead(userId: string): Promise<void>;
  getUnreadCount(userId: string): Promise<number>;
}