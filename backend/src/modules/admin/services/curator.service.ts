import { Injectable, Inject } from '@nestjs/common';
import { QuestionStatus } from '../../../shared/classes/enums';
import { mongoRange } from '../../../shared/database/abstractions/mongo-utils';
import {
  DailyVolumeRow,
  IQuestionRepository,
} from '../../../shared/database/repositories/question.repository.interface';
import { REPOSITORY_TOKENS } from '../../../shared/database/repositories';
import { AnalyticsQueryDto } from '../dto';

export interface DailyVolume extends DailyVolumeRow {}

export interface QueueStatusCount {
  status: QuestionStatus;
  label: string;
  count: number;
}

@Injectable()
export class CuratorService {
  constructor(
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
  ) {}

  /**
   * Full curator overview stats — one efficient query set.
   * Returns queue counts, submission volume, approval metrics, turnaround,
   * and top crops / states for the last 30 days.
   */
  async getCuratorStats(query: AnalyticsQueryDto) {
  const { fromDate, toDate, state, cropType } = query;
  const to = toDate ? new Date(toDate) : new Date();
  const from = fromDate
    ? new Date(fromDate)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Prior period of the same length, ending where the current one starts.
  const periodMs = to.getTime() - from.getTime();
  const priorTo = new Date(from.getTime() - 1);
  const priorFrom = new Date(priorTo.getTime() - periodMs);

  // Optional filters shared by every query.
  const filter: Record<string, unknown> = {};
  if (state) filter['state'] = state;
  if (cropType) filter['cropType'] = cropType;

  const whereClause = { ...filter, submittedAt: mongoRange(from, to) };
  const priorWhere = { ...filter, submittedAt: mongoRange(priorFrom, priorTo) };

  const [
    totalQuestions,
    approvedQuestions,
    rejectedQuestions,
    pendingQuestions,
    heldQuestions,
    priorTotal,
    priorApproved,
  ] = await Promise.all([
    this.questionRepo.count(whereClause),
    this.questionRepo.count({ ...whereClause, status: QuestionStatus.APPROVED }),
    this.questionRepo.count({ ...whereClause, status: QuestionStatus.REJECTED }),
    // Queue = current backlog, so it is NOT limited by the date range.
    this.questionRepo.count({ ...filter, status: QuestionStatus.PENDING }),
    this.questionRepo.count({ ...filter, status: QuestionStatus.HELD }),
    this.questionRepo.count(priorWhere),
    this.questionRepo.count({ ...priorWhere, status: QuestionStatus.APPROVED }),
  ]);

  // Grouped metrics run as native aggregation pipelines in the repository.
  const [avgReviewTurnaroundMinutes, dailyVolumeRaw, cropRows, stateRows, domainRows] =
    await Promise.all([
      this.questionRepo.avgReviewTurnaroundMinutes(from, to, filter, [
        QuestionStatus.APPROVED,
        QuestionStatus.REJECTED,
      ]),
      this.questionRepo.dailyVolume(from, to, filter),
      this.questionRepo.topField('cropType', from, to, filter, 8),
      this.questionRepo.topField('state', from, to, filter, 10),
      this.questionRepo.topDomains(from, to, filter, 8),
    ]);

  const pct = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 100) : 0;

  const approvalRate = pct(approvedQuestions, totalQuestions);
  const priorApprovalRate = pct(priorApproved, priorTotal);

  return {
    summary: {
      totalQuestions,
      approvedQuestions,
      rejectedQuestions,
      pendingQuestions,
      heldQuestions,
      queueTotal: pendingQuestions + heldQuestions,
      approvalRate,
      priorApprovalRate,
      approvalRateChange: approvalRate - priorApprovalRate,
      growthRate:
        priorTotal > 0
          ? Math.round(((totalQuestions - priorTotal) / priorTotal) * 100)
          : 0,
      priorTotalQuestions: priorTotal,
      avgReviewTurnaroundMinutes,
    },
    cropBreakdown: (cropRows ?? []).map((r:any) => ({
      cropType: r.key,
      count: Number(r.count),
    })),
    stateBreakdown: (stateRows ?? []).map((r: any) => ({
      state: r.key,
      count: Number(r.count),
    })),
    domainBreakdown: (domainRows ?? []).map((r: any) => ({
      domain: r.domain,
      count: Number(r.count),
    })),
    dailyVolume: (dailyVolumeRaw ?? [])
  };
}

  /**
   * Personal review stats for a given curator (userId), aggregated for the current week.
   */
  async getCuratorReviewerStats(userId: string) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday 00:00

    const [approved, rejected, held, pending] = await Promise.all([
      this.questionRepo.count({
        reviewerId: userId,
        status: QuestionStatus.APPROVED,
        reviewedAt: mongoRange(startOfWeek, now),
      }),
      this.questionRepo.count({
        reviewerId: userId,
        status: QuestionStatus.REJECTED,
        reviewedAt: mongoRange(startOfWeek, now),
      }),
      this.questionRepo.count({
        reviewerId: userId,
        status: QuestionStatus.HELD,
        reviewedAt: mongoRange(startOfWeek, now),
      }),
      // Questions still in queue assigned to / reviewed by this curator
      this.questionRepo.count({
        reviewerId: userId,
        status: QuestionStatus.PENDING,
      }),
    ]);

    const total = approved + rejected + held;
    return {
      week: {
        from: startOfWeek.toISOString(),
        to: now.toISOString(),
        approved,
        rejected,
        held,
        total,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        pending,
      },
    };
  }
}