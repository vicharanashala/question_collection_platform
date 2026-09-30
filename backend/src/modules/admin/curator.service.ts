import { Injectable, Inject } from '@nestjs/common';
import { Between } from 'typeorm';
import { QuestionStatus } from '../../shared/classes/enums';
import {
  DailyVolumeRow,
  IQuestionRepository,
} from '../../shared/database/repositories/IQuestion.repository';
import { REPOSITORY_TOKENS } from '../../shared/database/repositories';
import { AnalyticsQueryDto } from './dto';

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
  // async getCuratorStats() {
  //   const now = new Date();
  //   const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  //   const startOfWeek = new Date(startOfToday);
  //   startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
  //   const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  //   const thirtyDaysAgo = new Date(startOfToday);
  //   thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  //   // Prior 30-day window for growth / approval-rate comparison.
  //   const sixtyDaysAgo = new Date(thirtyDaysAgo);
  //   sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 1);
  //   const priorStart = new Date(sixtyDaysAgo);
  //   priorStart.setDate(priorStart.getDate() - 30);

  //   // ── Queue counts (PENDING + HELD, the non-terminal statuses) ─────────────
  //   // Delegate the aggregation to the repository: the chainable MongoQueryBuilder
  //   // does not implement groupBy / addSelect, so writing it here would return raw
  //   // question documents and NaN counts (see MongoQueryBuilder source for details).
  //   const queueRows = await this.questionRepo.countByStatuses([
  //     QuestionStatus.PENDING,
  //     QuestionStatus.HELD,
  //   ]);

  //   const statusLabels: Record<QuestionStatus, string> = {
  //     [QuestionStatus.PENDING]: 'Pending',
  //     [QuestionStatus.HELD]: 'On Hold',
  //     [QuestionStatus.APPROVED]: 'Approved',
  //     [QuestionStatus.REJECTED]: 'Rejected',
  //     [QuestionStatus.MOVED_TO_FINAL]: 'Moved to Final',
  //   };

  //   const queueBreakdown: QueueStatusCount[] = queueRows.map((r) => ({
  //     status: r.status,
  //     label: statusLabels[r.status] ?? r.status,
  //     count: r.count,
  //   }));

  //   const totalQueue = queueBreakdown.reduce((sum, r) => sum + r.count, 0);

  //   // ── Submission volume: today / this week / this month ────────────────────
  //   const [todayCount, weekCount, monthCount] = await Promise.all([
  //     this.questionRepo.count({
  //       where: { submittedAt: Between(startOfToday, now) },
  //     }),
  //     this.questionRepo.count({
  //       where: { submittedAt: Between(startOfWeek, now) },
  //     }),
  //     this.questionRepo.count({
  //       where: { submittedAt: Between(startOfMonth, now) },
  //     }),
  //   ]);

  //   // ── 30-day approved / rejected / total + prior 30-day window (for rate + growth)
  //   const [approved30, rejected30, total30, priorTotal, priorApproved] = await Promise.all([
  //     this.questionRepo.count({
  //       where: {
  //         submittedAt: Between(thirtyDaysAgo, now),
  //         status: QuestionStatus.APPROVED,
  //       },
  //     }),
  //     this.questionRepo.count({
  //       where: {
  //         submittedAt: Between(thirtyDaysAgo, now),
  //         status: QuestionStatus.REJECTED,
  //       },
  //     }),
  //     this.questionRepo.count({
  //       where: { submittedAt: Between(thirtyDaysAgo, now) },
  //     }),
  //     this.questionRepo.count({
  //       where: { submittedAt: Between(priorStart, sixtyDaysAgo) },
  //     }),
  //     this.questionRepo.count({
  //       where: {
  //         submittedAt: Between(priorStart, sixtyDaysAgo),
  //         status: QuestionStatus.APPROVED,
  //       },
  //     }),
  //   ]);

  //   const approvalRate = total30 > 0 ? Math.round((approved30 / total30) * 100) : 0;

  //   // ── Aggregations that the chainable MongoQueryBuilder cannot do ──────────
  //   // These delegate to native Mongoose pipelines so the data actually flows.
  //   const [avgReviewTurnaroundMinutes, dailyVolume, cropRows, stateRows, domainRows] =
  //     await Promise.all([
  //       this.questionRepo.avgReviewTurnaroundMinutesSince(thirtyDaysAgo, [
  //         QuestionStatus.APPROVED,
  //         QuestionStatus.REJECTED,
  //       ]),
  //       this.questionRepo.dailyVolumeSince(thirtyDaysAgo),
  //       this.questionRepo.topFieldSince('cropType', thirtyDaysAgo, 8),
  //       this.questionRepo.topFieldSince('state', thirtyDaysAgo, 10),
  //       this.questionRepo.topDomainsSince(thirtyDaysAgo, 8),
  //     ]);

  //   const cropBreakdown = (cropRows ?? []).map((r) => ({
  //     cropType: r.key,
  //     count: r.count,
  //   }));
  //   const stateBreakdown = (stateRows ?? []).map((r) => ({
  //     state: r.key,
  //     count: r.count,
  //   }));
  //   const domainBreakdown = (domainRows ?? []).map((r) => ({
  //     domain: r.domain,
  //     count: r.count,
  //   }));

  //   // ── Growth vs prior 30-day period ────────────────────────────────────────
  //   const growthRate =
  //     priorTotal > 0
  //       ? Math.round(((total30 - priorTotal) / priorTotal) * 100)
  //       : 0;
  //   const priorApprovalRate = priorTotal > 0 ? Math.round((priorApproved / priorTotal) * 100) : 0;

  //   return {
  //     queue: {
  //       total: totalQueue,
  //       breakdown: queueBreakdown,
  //     },
  //     volume: {
  //       today: todayCount,
  //       thisWeek: weekCount,
  //       thisMonth: monthCount,
  //       last30Days: total30,
  //     },
  //     performance: {
  //       approved30Days: approved30,
  //       rejected30Days: rejected30,
  //       approvalRate,
  //       priorApprovalRate,
  //       approvalRateChange: approvalRate - priorApprovalRate,
  //       avgReviewTurnaroundMinutes,
  //     },
  //     growth: {
  //       last30Days: total30,
  //       prior30Days: priorTotal,
  //       growthRate,
  //     },
  //     dailyVolume,
  //     cropBreakdown,
  //     stateBreakdown,
  //     domainBreakdown,
  //   };
  // }

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

  const whereClause = { ...filter, submittedAt: Between(from, to) };
  const priorWhere = { ...filter, submittedAt: Between(priorFrom, priorTo) };

  const [
    totalQuestions,
    approvedQuestions,
    rejectedQuestions,
    pendingQuestions,
    heldQuestions,
    priorTotal,
    priorApproved,
  ] = await Promise.all([
    this.questionRepo.count({ where: whereClause }),
    this.questionRepo.count({
      where: { ...whereClause, status: QuestionStatus.APPROVED },
    }),
    this.questionRepo.count({
      where: { ...whereClause, status: QuestionStatus.REJECTED },
    }),
    // Queue = current backlog, so it is NOT limited by the date range.
    this.questionRepo.count({
      where: { ...filter, status: QuestionStatus.PENDING },
    }),
    this.questionRepo.count({
      where: { ...filter, status: QuestionStatus.HELD },
    }),
    this.questionRepo.count({ where: priorWhere }),
    this.questionRepo.count({
      where: { ...priorWhere, status: QuestionStatus.APPROVED },
    }),
  ]);

  // Aggregations the chainable MongoQueryBuilder can't do (no groupBy/addSelect),
  // so these stay as native Mongoose pipelines in the repository.
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
        where: {
          reviewerId: userId,
          status: QuestionStatus.APPROVED,
          reviewedAt: Between(startOfWeek, now),
        },
      }),
      this.questionRepo.count({
        where: {
          reviewerId: userId,
          status: QuestionStatus.REJECTED,
          reviewedAt: Between(startOfWeek, now),
        },
      }),
      this.questionRepo.count({
        where: {
          reviewerId: userId,
          status: QuestionStatus.HELD,
          reviewedAt: Between(startOfWeek, now),
        },
      }),
      // Questions still in queue assigned to / reviewed by this curator
      this.questionRepo.count({
        where: {
          reviewerId: userId,
          status: QuestionStatus.PENDING,
        },
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