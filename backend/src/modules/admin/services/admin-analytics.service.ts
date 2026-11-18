import { isTesterCondition } from "../../../shared/utils/tester.util";
import { mongoIn, mongoRange } from "../../../shared/database/abstractions/mongo-utils";
import { resolveUserIdScope } from "../../../shared/utils/anveshan-mode.util";
import { Injectable, Inject } from "@nestjs/common";
import { Question, Transaction, AuditLog } from "../../../shared/database/entities";
import { QuestionStatus } from "../../../shared/classes/enums";
import { AnalyticsQueryDto, ExportQueryDto, FraudQueryDto } from "../dto";
import {
  IUserRepository,
  IQuestionRepository,
  IWalletRepository,
  ITransactionRepository,
  IWithdrawalRequestRepository,
  IAuditLogRepository,
} from "../../../shared/database/repositories";
import { REPOSITORY_TOKENS } from "../../../shared/database/repositories";
import { User } from "@/shared/database/mongodb/schemas/user.schema";
import { Wallet } from "@/shared/database/mongodb/schemas/wallet.schema";
import { WithdrawalRequest } from "@/shared/database/mongodb/schemas/withdrawal-request.schema";

// Staff dashboards, metrics, fraud stats and data exports.
@Injectable()
export class AdminAnalyticsService {
  constructor(
    @Inject(REPOSITORY_TOKENS.User)
    private readonly userRepo: IUserRepository,
    @Inject(REPOSITORY_TOKENS.Question)
    private readonly questionRepo: IQuestionRepository,
    @Inject(REPOSITORY_TOKENS.Wallet)
    private readonly walletRepo: IWalletRepository,
    @Inject(REPOSITORY_TOKENS.Transaction)
    private readonly transactionRepo: ITransactionRepository,
    @Inject(REPOSITORY_TOKENS.WithdrawalRequest)
    private readonly withdrawalRepo: IWithdrawalRequestRepository,
    @Inject(REPOSITORY_TOKENS.AuditLog)
    private readonly auditRepo: IAuditLogRepository,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Section 4: Analytics & Dashboard
  // ─────────────────────────────────────────────────────────────

  async getDashboardStats(query: AnalyticsQueryDto) {
    const { fromDate, toDate, state, cropType } = query;
    const from = fromDate
      ? new Date(fromDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const whereClause: Record<string, unknown> = {
      submittedAt: mongoRange(from, to),
    };
    if (state) whereClause["state"] = state;
    if (cropType) whereClause["cropType"] = cropType;

    const [
      totalQuestions,
      approvedQuestions,
      rejectedQuestions,
      pendingQuestions,
      totalUsers,
      flaggedQuestions,
    ] = await Promise.all([
      this.questionRepo.count({ ...whereClause }),
      this.questionRepo.count({ ...whereClause, status: QuestionStatus.APPROVED }),
      this.questionRepo.count({ ...whereClause, status: QuestionStatus.REJECTED }),
      this.questionRepo.count({
        ...whereClause,
        status: mongoIn([QuestionStatus.PENDING, QuestionStatus.HELD]),
      }),
      this.userRepo.count(),
      this.questionRepo.count({ ...whereClause, duplicateFlag: true }),
    ]);

    // State breakdown
    const stateBreakdownRaw = await this.questionRepo.topFieldSince("state", from, 10, to);

    // Category breakdown
    const categoryBreakdownRaw = await this.userRepo.getCategoryDistribution();

    // Daily question volume (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyVolumeRaw = await this.questionRepo.dailyVolumeSince(sevenDaysAgo);

    return {
      summary: {
        totalQuestions,
        approvedQuestions,
        rejectedQuestions,
        pendingQuestions,
        totalUsers,
        flaggedQuestions,
        approvalRate:
          totalQuestions > 0
            ? Math.round((approvedQuestions / totalQuestions) * 100)
            : 0,
      },
      stateBreakdown: stateBreakdownRaw.map((r) => ({
        state: r.key,
        count: r.count,
      })),
      categoryBreakdown: categoryBreakdownRaw.map((r) => ({
        category: r.category,
        count: r.count,
      })),
      dailyVolume: dailyVolumeRaw.map((r) => ({
        date: r.date,
        total: r.submitted,
        approved: r.approved,
      })),
    };
  }

  // Turns the staff Anveshan and Tester scope into a condition for each data source behind the dashboard.
  private async resolveDashboardScope(query: AnalyticsQueryDto) {
    const userFilter: Record<string, unknown> = { ...isTesterCondition(query.tester) };
    if (query.anveshanScope) {
      userFilter.isAnveshanUser = query.anveshanScope === "only" ? true : { $ne: true };
    }
    const userIdFilter = await resolveUserIdScope(this.userRepo, query);
    let walletIdFilter: Record<string, unknown> | undefined;
    if (userIdFilter) {
      const wallets = await this.walletRepo.findAll({ userId: userIdFilter });
      walletIdFilter = { $in: wallets.map((wallet) => wallet._id.toString()) };
    }
    return {
      userFilter: Object.keys(userFilter).length > 0 ? userFilter : undefined,
      userIdFilter,
      walletIdFilter,
    };
  }

  async getStats(query: AnalyticsQueryDto) {
    const scope = await this.resolveDashboardScope(query);
    const now = new Date();

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [
      userStats,
      questionStats,
      usersThisWeek,
      questionsThisWeek,
      roleDistribution,
      categoryDistribution,
      historical,
      signupRaw,
    ] = await Promise.all([
      this.userRepo.getVerificationStats(scope.userFilter),

      this.questionRepo.getQuestionStats(scope.userIdFilter),

      this.userRepo.countCreatedBetween(sevenDaysAgo, now, scope.userFilter),

      this.questionRepo.countSubmittedBetween(sevenDaysAgo, now, scope.userIdFilter),

      this.userRepo.getRoleDistribution(scope.userFilter),

      this.userRepo.getCategoryDistribution(scope.userFilter),

      this.questionRepo.getDailyStatsSince(ninetyDaysAgo, scope.userIdFilter),

      this.userRepo.getDailySignupsSince(ninetyDaysAgo, scope.userFilter),

      // this.auditRepo.getRecentWithActorName(20),
    ]);

    const signupMap = new Map(signupRaw.map((r) => [r.date, r.signups]));

    const historicalDays = historical.map((h) => ({
      date: h.date,
      users: h.users,
      questions: h.questions,
      signups: signupMap.get(h.date) ?? 0,
      approved: h.approved,
      rejected: h.rejected,
    }));

    return {
      dashboard: {
        totalUsers: userStats.total,
        verifiedUsers: userStats.verified,
        pendingUsers: userStats.pending,
        suspendedUsers: userStats.suspended,
        bannedUsers: userStats.banned,

        totalQuestions: questionStats.total,
        approvedQuestions: questionStats.approved,
        rejectedQuestions: questionStats.rejected,
        pendingQuestions: questionStats.pending,

        questionsThisWeek,
        usersThisWeek,
      },

      roleDistribution,

      categoryDistribution,

      historical: historicalDays,

      avgReviewTurnaroundMinutes: null,
    };
  }

  async getFinancialSummary(query: AnalyticsQueryDto) {
    const days = query.days ?? 30;

    const now = new Date();

    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const todayStart = new Date(now);

    todayStart.setHours(0, 0, 0, 0);

    const [withdrawalSummary, totalWalletBalance] = await Promise.all([
      this.withdrawalRepo.getFinancialSummary(since, todayStart, now),

      this.walletRepo.getTotalBalance(),
    ]);

    return {
      totalPaidOut: withdrawalSummary.totalPaidOut,

      pendingWithdrawals: withdrawalSummary.pendingWithdrawals,

      completedWithdrawals: withdrawalSummary.completedWithdrawals,

      failedWithdrawals: withdrawalSummary.failedWithdrawals,

      totalWalletBalance,

      today: withdrawalSummary.today,

      dailyPayoutTrend: withdrawalSummary.dailyPayoutTrend,
    };
  }

  async getRewardSummary(query: AnalyticsQueryDto) {
    const { fromDate, toDate, state } = query;

    const from = fromDate
      ? new Date(fromDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const to = toDate ? new Date(toDate) : new Date();

    const [rewardTxs, withdrawalStats] = await Promise.all([
      this.transactionRepo.getRewardSummary(from, to, state),

      this.withdrawalRepo.getRewardSummary(from, to),
    ]);

    return {
      totalRewarded: rewardTxs.totalRewarded,
      rewardCount: rewardTxs.rewardCount,
      avgReward: rewardTxs.avgReward,

      totalWithdrawn: withdrawalStats.totalWithdrawn,
      withdrawalCount: withdrawalStats.withdrawalCount,
      pendingWithdrawals: withdrawalStats.pendingWithdrawals,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Section 6: Fraud Monitoring
  // ─────────────────────────────────────────────────────────────

  async getFraudStats(query: FraudQueryDto) {
    const { page = 1, limit = 20, state } = query;

    // Duplicate submissions (questions flagged as duplicates)
    const { items, total } = await this.questionRepo.findDuplicatesWithSubmitter({ state, page, limit });

    const rejectedCount = await this.questionRepo.count({ status: QuestionStatus.REJECTED });

    return {
      duplicateSubmissions: items,
      totalDuplicates: total,
      totalRejected: rejectedCount,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Section 8: Question Metrics (curator read-only)
  // ─────────────────────────────────────────────────────────────

  async getQuestionMetrics(query: AnalyticsQueryDto) {
    const { fromDate, toDate, state, cropType } = query;
    const from = fromDate
      ? new Date(fromDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const baseWhere: Record<string, unknown> = {
      submittedAt: mongoRange(from, to),
    };
    if (state) baseWhere["state"] = state;
    if (cropType) baseWhere["cropType"] = cropType;

    const [total, approved, rejected, pending, held, duplicates] =
      await Promise.all([
        this.questionRepo.count({ ...baseWhere }),
        this.questionRepo.count({ ...baseWhere, status: QuestionStatus.APPROVED }),
        this.questionRepo.count({ ...baseWhere, status: QuestionStatus.REJECTED }),
        this.questionRepo.count({ ...baseWhere, status: QuestionStatus.PENDING }),
        this.questionRepo.count({ ...baseWhere, status: QuestionStatus.HELD }),
        this.questionRepo.count({ ...baseWhere, duplicateFlag: true }),
      ]);

    // Submission volume by day
    const dailyRaw = await this.questionRepo.dailyVolumeSince(from, to);

    // Top crops by volume
    const cropBreakdownRaw = await this.questionRepo.topFieldSince("cropType", from, 10, to);

    // State breakdown
    const stateBreakdownRaw = await this.questionRepo.topFieldSince("state", from, undefined, to);

    // Review turnaround (avg time from submittedAt to reviewedAt for approved/rejected)
    const avgTurnaroundMinutes = await this.questionRepo.avgReviewTurnaroundMinutes(
      from,
      to,
      {},
      [QuestionStatus.APPROVED, QuestionStatus.REJECTED],
      "submittedAt",
    );

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        total,
        approved,
        rejected,
        pending,
        inAiReview: 0,
        inHumanReview: 0,
        duplicates,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
        rejectionRate: total > 0 ? Math.round((rejected / total) * 100) : 0,
      },
      dailyVolume: dailyRaw.map((r) => ({
        date: r.date,
        total: r.submitted,
        approved: r.approved,
        rejected: r.rejected,
      })),
      cropBreakdown: cropBreakdownRaw.map((r) => ({
        cropType: r.key,
        count: r.count,
      })),
      stateBreakdown: stateBreakdownRaw.map((r) => ({
        state: r.key,
        count: r.count,
      })),
      avgReviewTurnaroundMinutes: avgTurnaroundMinutes || null,
    };
  }

  /**
   * Curator dashboard: question metrics + live review queue depth.
   * Wraps getQuestionMetrics with the current queue counts curators care about.
   * GET /admin/analytics/curator-dashboard  →  getCuratorDashboard
   */
  async getCuratorDashboard(query: AnalyticsQueryDto) {
    const [metrics, queueDepth] = await Promise.all([
      this.getQuestionMetrics(query),
      this.getReviewQueueDepth(),
    ]);

    return {
      questions: metrics,
      reviewQueue: queueDepth,
    };
  }

  /** Current count of questions in each pending/review status bucket. */
  private async getReviewQueueDepth() {
    const [pending, held] = await Promise.all([
      this.questionRepo.count({ status: QuestionStatus.PENDING }),
      this.questionRepo.count({ status: QuestionStatus.HELD }),
    ]);
    return {
      pending,
      held,
      totalActionable: pending + held,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Section 8c: Analytics (Task 11 — dedicated analytics endpoints)
  // ─────────────────────────────────────────────────────────────

  /** Explicit fromDate/toDate win; otherwise the window is the last `days` (default 30). */
  private resolveAnalyticsRange(query: AnalyticsQueryDto) {
    const to = query.toDate ? new Date(query.toDate) : new Date();
    const from = query.fromDate
      ? new Date(query.fromDate)
      : new Date(to.getTime() - (query.days ?? 30) * 24 * 60 * 60 * 1000);
    return { from, to };
  }

  /**
   * All analytics dashboard data in a single call.
   * GET /analytics/dashboard  →  getAnalyticsDashboard
   */
  async getAnalyticsDashboard(query: AnalyticsQueryDto) {
    const scope = await this.resolveDashboardScope(query);
    const [userAnalytics, questionAnalytics, rewardAnalytics] =
      await Promise.all([
        this.getUserAnalytics(query),
        this.getQuestionAnalytics(query),
        this.getRewardAnalytics(query),
      ]);

    // Dataset growth rate: approved questions this month vs last month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [thisMonthApproved, lastMonthApproved] = await Promise.all([
      this.questionRepo.count({
        status: QuestionStatus.APPROVED,
        submittedAt: mongoRange(thisMonthStart, now),
        ...(scope.userIdFilter ? { userId: scope.userIdFilter } : {}),
      }),
      this.questionRepo.count({
        status: QuestionStatus.APPROVED,
        submittedAt: mongoRange(lastMonthStart, lastMonthEnd),
        ...(scope.userIdFilter ? { userId: scope.userIdFilter } : {}),
      }),
    ]);

    const growthRate =
      lastMonthApproved > 0
        ? Math.round(
            ((thisMonthApproved - lastMonthApproved) / lastMonthApproved) * 100,
          )
        : thisMonthApproved > 0
          ? 100
          : 0;

    // Cost per approved question (total rewards paid / approved questions)
    const totalRewarded = rewardAnalytics.totalRewarded;
    const totalApproved = questionAnalytics.summary.approved;
    const costPerApproved =
      totalApproved > 0
        ? parseFloat((totalRewarded / totalApproved).toFixed(2))
        : 0;

    const { from, to } = this.resolveAnalyticsRange(query);
    const [statesWithApproved, avgReviewTurnaroundMinutes] = await Promise.all([
      this.questionRepo.countDistinctStates(from, to, [
        QuestionStatus.APPROVED,
        QuestionStatus.MOVED_TO_FINAL,
      ], scope.userIdFilter),
      this.questionRepo.avgReviewTurnaroundMinutesSince(from, [
        QuestionStatus.APPROVED,
        QuestionStatus.MOVED_TO_FINAL,
        QuestionStatus.REJECTED,
      ], scope.userIdFilter),
    ]);

    // Indian states count reference (29 states + 8 UTs)
    const totalPossibleStates = 37;
    const participationRate = Math.round(
      (statesWithApproved / totalPossibleStates) * 100,
    );

    return {
      // Success metric cards
      totalRegisteredUsers: userAnalytics.totalUsers,
      monthlyActiveUsers: userAnalytics.mau,
      totalApprovedQuestions: questionAnalytics.summary.approved,
      totalRewarded: rewardAnalytics.totalRewarded,
      datasetGrowthRate: growthRate,
      costPerApprovedQuestion: costPerApproved,
      stateParticipationRate: participationRate,
      statesWithApprovedQuestions: statesWithApproved,
      avgReviewTurnaroundMinutes,
      // Sub-analytics (for charts)
      users: userAnalytics,
      questions: questionAnalytics,
      rewards: rewardAnalytics,
    };
  }

  /**
   * User engagement: DAU, MAU, new signups, retention.
   * GET /analytics/users  →  getUserAnalytics
   */
  async getUserAnalytics(query: AnalyticsQueryDto) {
    const { state } = query;
    const scope = await this.resolveDashboardScope(query);
    const { from, to } = this.resolveAnalyticsRange(query);
    const DAY_MS = 24 * 60 * 60 * 1000;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Prior window of equal length, for the signup growth delta
    const periodMs = Math.max(DAY_MS, to.getTime() - from.getTime());
    const priorFrom = new Date(from.getTime() - periodMs);
    const priorTo = new Date(from.getTime() - 1);

    const [totalUsers, activity, priorSignups, categoryBreakdown, roleDistribution] =
      await Promise.all([
        this.userRepo.countByFilter(scope.userFilter ?? {}),
        this.userRepo.getActivityAnalytics({
          from,
          to,
          mauFrom: new Date(Date.now() - 30 * DAY_MS),
          todayStart,
          state,
          userFilter: scope.userFilter,
        }),
        this.userRepo.countCreatedBetween(priorFrom, priorTo, scope.userFilter),
        this.userRepo.getCategoryDistribution(scope.userFilter),
        this.userRepo.getRoleDistribution(scope.userFilter),
      ]);

    const signupMap = new Map(
      activity.signupTrend.map((r) => [r.date, r.signups]),
    );
    const loginMap = new Map(activity.loginTrend.map((r) => [r.date, r.dau]));
    const signupTrend = [...new Set([...signupMap.keys(), ...loginMap.keys()])]
      .sort()
      .map((date) => ({
        date,
        signups: signupMap.get(date) ?? 0,
        dau: loginMap.get(date) ?? 0,
      }));

    const currSignups = activity.newUsers;
    const signupGrowth =
      priorSignups > 0
        ? Math.round(((currSignups - priorSignups) / priorSignups) * 100)
        : currSignups > 0
          ? 100
          : 0;

    return {
      totalUsers,
      newUsers: activity.newUsers,
      newVerified: activity.newVerified,
      newPending: activity.newPending,
      activeUsers: activity.activeUsers,
      mau: activity.mau,
      dau: activity.dau,
      signupGrowth,
      signupTrend,
      stateBreakdown: activity.stateBreakdown,
      districtBreakdown: activity.districtBreakdown,
      categoryBreakdown,
      roleDistribution,
    };
  }

  /**
   * Question volume + breakdown by state, crop, domain.
   * GET /analytics/questions  →  getQuestionAnalytics
   */
  async getQuestionAnalytics(query: AnalyticsQueryDto) {
    const { state, cropType } = query;
    const scope = await this.resolveDashboardScope(query);
    const { from, to } = this.resolveAnalyticsRange(query);

    // Prior window of equal length, for the submission growth delta
    const periodMs = Math.max(
      24 * 60 * 60 * 1000,
      to.getTime() - from.getTime(),
    );
    const priorFrom = new Date(from.getTime() - periodMs);
    const priorTo = new Date(from.getTime() - 1);

    const [analytics, priorTotal] = await Promise.all([
      this.questionRepo.getQuestionAnalytics({
        from,
        to,
        state,
        cropType,
        userIdFilter: scope.userIdFilter,
      }),
      this.questionRepo.countSubmittedBetween(priorFrom, priorTo, scope.userIdFilter),
    ]);

    const { total, approved } = analytics.summary;

    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const growthRate =
      priorTotal > 0
        ? Math.round(((total - priorTotal) / priorTotal) * 100)
        : total > 0
          ? 100
          : 0;

    return {
      ...analytics,
      summary: {
        ...analytics.summary,
        approvalRate,
        growthRate,
      },
    };
  }

  /**
   * Reward and payout analytics.
   * GET /analytics/rewards  →  getRewardAnalytics
   */
  async getRewardAnalytics(query: AnalyticsQueryDto) {
    const { state } = query;
    const scope = await this.resolveDashboardScope(query);
    const { from, to } = this.resolveAnalyticsRange(query);

    const [rewards, withdrawals] = await Promise.all([
      this.transactionRepo.getRewardAnalytics(from, to, state, scope.walletIdFilter),
      this.withdrawalRepo.getStatusSummary(from, to, scope.userIdFilter),
    ]);

    return {
      totalRewarded: parseFloat(rewards.totalRewarded.toFixed(2)),
      rewardCount: rewards.rewardCount,
      avgReward: parseFloat(rewards.avgReward.toFixed(2)),
      totalPool: rewards.totalPool,
      dailyRewardTrend: rewards.dailyRewardTrend,
      withdrawals,
    };
  }

  private toCSV(rows: Record<string, unknown>[], columns: string[]): string {
    const header = columns.join(",");
    const lines = rows.map((row) =>
      columns
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(","),
    );
    return [header, ...lines].join("\n");
  }

  /**
   * Export with true Excel support (json2xls).
   * Returns { format, data: string } for CSV, { format, xls: Buffer } for Excel.
   */
  async exportData(dto: ExportQueryDto) {
    const {
      fromDate,
      toDate,
      state,
      cropType,
      format = "csv",
      dataType = "questions",
    } = dto;
    const from = fromDate ? new Date(fromDate) : new Date(0);
    const to = toDate ? new Date(toDate) : new Date();

    const COLUMNS: Record<NonNullable<ExportQueryDto["dataType"]>, string[]> = {
      questions: [
        "id",
        "mobileNumber",
        "name",
        "questionText",
        "language",
        "domains",
        "cropType",
        "season",
        "state",
        "district",
        "mediaType",
        "status",
        "submittedAt",
        "reviewedAt",
        "rejectionReason",
        "heldReason",
        "approvalReason",
      ],
      users: [
        "id",
        "mobileNumber",
        "name",
        "category",
        "state",
        "district",
        "verificationStatus",
        "role",
        "createdAt",
        "lastLoginAt",
      ],
      rewards: [
        "id",
        "mobileNumber",
        "name",
        "amount",
        "type",
        "source",
        "description",
        "status",
        "referenceId",
        "createdAt",
      ],
      withdrawals: [
        "id",
        "mobileNumber",
        "name",
        "amount",
        "payoutMethod",
        "status",
        "createdAt",
        "processedAt",
        "rejectionReason",
      ],
    };
    const columns = COLUMNS[dataType];

    const filters = { from, to, state };
    const rawRows =
      dataType === "questions"
        ? await this.questionRepo.findForExport({ ...filters, cropType })
        : dataType === "users"
          ? await this.userRepo.findForExport(filters)
          : dataType === "rewards"
            ? await this.transactionRepo.findRewardsForExport(filters)
            : await this.withdrawalRepo.findForExport(filters);

    // Flatten to plain strings/numbers so CSV and Excel cells are readable
    const rows = rawRows.map((row) =>
      Object.fromEntries(
        columns.map((col) => {
          const v = row[col];
          if (v == null) return [col, ""];
          if (v instanceof Date) return [col, v.toISOString()];
          if (Array.isArray(v)) return [col, v.join(", ")];
          if (typeof v === "number") return [col, v];
          return [col, String(v)];
        }),
      ),
    );

    if (format === "csv") {
      return { format: "csv", data: this.toCSV(rows, columns) };
    }

    // json2xls reads column types from the first row, so it needs at least one
    const json2xls = require("json2xls");
    const xls = json2xls(
      rows.length ? rows : [Object.fromEntries(columns.map((c) => [c, ""]))],
      { fields: columns },
    );
    return { format: "excel", xls: xls as unknown as string };
  }
}
