import { BaseRepository } from '../abstractions/base.repository';
import { Report } from '../entities';
import { ReportStatus, ReportPriority } from '../../classes/enums';

export interface ReportFilter {
  id?: string;
  userId?: string;
  status?: ReportStatus;
  priority?: ReportPriority;
  type?: string;
  createdAt?: Date;
}

export interface IReportRepository extends BaseRepository<Report> {
  findByUserId(userId: string, limit?: number): Promise<Report[]>;
  findByStatus(status: ReportStatus, limit?: number): Promise<Report[]>;
}