import { User } from './user.entity';
import { ReportReply } from './report-reply.entity';
import { ReportCategory, ReportPriority, ReportStatus } from '../../classes/enums';

export interface Report {
  id: string;

  userId: string;

  title: string;

  description: string;

  category: ReportCategory;

  status: ReportStatus;

  priority: ReportPriority;

  /** Optional link to a related entity (e.g. question ID or withdrawal ID) */
  relatedEntityId: string | null;

  /** Type of related entity: 'question' | 'withdrawal' | 'wallet' */
  relatedEntityType: string | null;

  user: User;

  replies: ReportReply[];

  createdAt: Date;

  updatedAt: Date;
}