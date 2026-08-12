import { BaseRepository } from '../abstractions/base.repository';
import { ReportReply } from '../entities';

export interface ReportReplyFilter {
  id?: string;
  reportId?: string;
  adminId?: string;
}

export interface IReportReplyRepository extends BaseRepository<ReportReply> {
  findByReportId(reportId: string): Promise<ReportReply[]>;
}