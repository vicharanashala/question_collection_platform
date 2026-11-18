import { Report } from './report.entity';
import { User } from './user.entity';

export interface ReportReply {
  id: string;

  reportId: string;

  /** The admin/curator who sent this reply */
  adminId: string;

  message: string;

  report: Report;

  admin: User;

  createdAt: Date;
}