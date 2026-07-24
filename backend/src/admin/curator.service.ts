import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, SelectQueryBuilder } from 'typeorm';
import { Question } from '../database/entities';
import { QuestionStatus } from '../common/enums';

export interface DailyVolume {
  date: string;
  submitted: number;
  approved: number;
  rejected: number;
  held: number;
}

export interface QueueStatusCount {
  status: QuestionStatus;
  label: string;
  count: number;
}

@Injectable()
export class CuratorService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {}

  /**
   * Full curator overview stats — one efficient query set.
   * Returns queue counts, submission volume, approval metrics, turnaround,
   * and top crops / states for the last 30 days.
   */
  async getCuratorStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(startOfToday);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    // ── Queue counts (all non-terminal statuses) ─────────────────────────────
    const queueCounts = await this.questionRepo
      .createQueryBuilder('q')
      .select('q.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('q.status IN (:...statuses)', {
        statuses: [
          QuestionStatus.PENDING,
          QuestionStatus.AI_REVIEW,
          QuestionStatus.HUMAN_REVIEW,
          QuestionStatus.HELD,
        ],
      })
      .groupBy('q.status')
      .getRawMany<{ status: string; count: string }>();

    const statusLabels: Record<string, string> = {
      [QuestionStatus.PENDING]: 'Pending',
      [QuestionStatus.AI_REVIEW]: 'AI Review',
      [QuestionStatus.HUMAN_REVIEW]: 'Human Review',
      [QuestionStatus.HELD]: 'On Hold',
    };

    const queueBreakdown: QueueStatusCount[] = queueCounts.map((r) => ({
      status: r.status as QuestionStatus,
      label: statusLabels[r.status] ?? r.status,
      count: Number(r.count),
    }));

    const totalQueue = queueBreakdown.reduce((sum, r) => sum + r.count, 0);

    // ── Submission volume: today / this week / this month ────────────────────
    const [todayCount, weekCount, monthCount] = await Promise.all([
      this.questionRepo.count({
        where: { submittedAt: Between(startOfToday, now) },
      }),
      this.questionRepo.count({
        where: { submittedAt: Between(startOfWeek, now) },
      }),
      this.questionRepo.count({
        where: { submittedAt: Between(startOfMonth, now) },
      }),
    ]);

    // ── 30-day approved / rejected / total (for approval rate) ──────────────
    const [approved30, rejected30, total30] = await Promise.all([
      this.questionRepo.count({
        where: {
          submittedAt: Between(thirtyDaysAgo, now),
          status: QuestionStatus.APPROVED,
        },
      }),
      this.questionRepo.count({
        where: {
          submittedAt: Between(thirtyDaysAgo, now),
          status: QuestionStatus.REJECTED,
        },
      }),
      this.questionRepo.count({
        where: { submittedAt: Between(thirtyDaysAgo, now) },
      }),
    ]);

    const approvalRate = total30 > 0 ? Math.round((approved30 / total30) * 100) : 0;

    // ── Average review turnaround (approved + rejected only) ─────────────────
    const avgTurnaroundRaw = await this.questionRepo
      .createQueryBuilder('q')
      .select('AVG(EXTRACT(EPOCH FROM (q.reviewedAt - q.submittedAt)))', 'avg_seconds')
      .where('q.reviewedAt IS NOT NULL')
      .andWhere('q.status IN (:...statuses)', {
        statuses: [QuestionStatus.APPROVED, QuestionStatus.REJECTED],
      })
      .andWhere('q.submittedAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .getRawOne<{ avg_seconds: string | null }>();

    const avgTurnaroundMinutes =
      avgTurnaroundRaw?.avg_seconds != null
        ? Math.round(Number(avgTurnaroundRaw.avg_seconds) / 60)
        : null;

    // ── Daily volume for last 30 days ────────────────────────────────────────
    const dailyRaw: Array<{
      date: string;
      submitted: string;
      approved: string;
      rejected: string;
      held: string;
    }> = await this.questionRepo
      .createQueryBuilder('q')
      .select("TO_CHAR(q.submittedAt, 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'submitted')
      .addSelect(
        "COUNT(CASE WHEN q.status = 'approved' THEN 1 END)",
        'approved',
      )
      .addSelect(
        "COUNT(CASE WHEN q.status = 'rejected' THEN 1 END)",
        'rejected',
      )
      .addSelect(
        "COUNT(CASE WHEN q.status = 'held' THEN 1 END)",
        'held',
      )
      .where('q.submittedAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy("TO_CHAR(q.submittedAt, 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    const dailyVolume: DailyVolume[] = dailyRaw.map((r) => ({
      date: r.date,
      submitted: Number(r.submitted),
      approved: Number(r.approved),
      rejected: Number(r.rejected),
      held: Number(r.held),
    }));

    // ── Top crops (last 30 days) ─────────────────────────────────────────────
    const cropBreakdown: Array<{ cropType: string; count: number }> = await this.questionRepo
      .createQueryBuilder('q')
      .select('q.cropType', 'cropType')
      .addSelect('COUNT(*)', 'count')
      .where('q.submittedAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy('q.cropType')
      .orderBy('count', 'DESC')
      .limit(8)
      .getRawMany()
      .then((rows) => rows.map((r) => ({ cropType: r.cropType, count: Number(r.count) })));

    // ── Top states (last 30 days) ────────────────────────────────────────────
    const stateBreakdown: Array<{ state: string; count: number }> = await this.questionRepo
      .createQueryBuilder('q')
      .select('q.state', 'state')
      .addSelect('COUNT(*)', 'count')
      .where('q.submittedAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy('q.state')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany()
      .then((rows) => rows.map((r) => ({ state: r.state, count: Number(r.count) })));

    // ── Domain breakdown (last 30 days) ─────────────────────────────────────
    const domainBreakdown: Array<{ domain: string; count: number }> = await this.questionRepo
      .createQueryBuilder('q')
      .select('UNNEST(q.domains)', 'domain')
      .addSelect('COUNT(*)', 'count')
      .where('q.submittedAt >= :thirtyDaysAgo', { thirtyDaysAgo })
      .groupBy('domain')
      .orderBy('count', 'DESC')
      .limit(8)
      .getRawMany()
      .then((rows) => rows.map((r) => ({ domain: r.domain, count: Number(r.count) })));

    // ── Growth vs prior 30-day period ────────────────────────────────────────
    const sixtyDaysAgo = new Date(thirtyDaysAgo);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 1);
    const priorStart = new Date(sixtyDaysAgo);
    priorStart.setDate(priorStart.getDate() - 30);

    const [priorTotal, priorApproved] = await Promise.all([
      this.questionRepo.count({
        where: {
          submittedAt: Between(priorStart, sixtyDaysAgo),
        },
      }),
      this.questionRepo.count({
        where: {
          submittedAt: Between(priorStart, sixtyDaysAgo),
          status: QuestionStatus.APPROVED,
        },
      }),
    ]);

    const growthRate =
      priorTotal > 0
        ? Math.round(((total30 - priorTotal) / priorTotal) * 100)
        : 0;
    const priorApprovalRate = priorTotal > 0 ? Math.round((priorApproved / priorTotal) * 100) : 0;

    return {
      queue: {
        total: totalQueue,
        breakdown: queueBreakdown,
      },
      volume: {
        today: todayCount,
        thisWeek: weekCount,
        thisMonth: monthCount,
        last30Days: total30,
      },
      performance: {
        approved30Days: approved30,
        rejected30Days: rejected30,
        approvalRate,
        priorApprovalRate,
        approvalRateChange: approvalRate - priorApprovalRate,
        avgTurnaroundMinutes,
      },
      growth: {
        last30Days: total30,
        prior30Days: priorTotal,
        growthRate,
      },
      dailyVolume,
      cropBreakdown,
      stateBreakdown,
      domainBreakdown,
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
          status: Between(QuestionStatus.PENDING, QuestionStatus.HUMAN_REVIEW),
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