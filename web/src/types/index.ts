export type UserRole = "user" | "admin" | "super_admin" | "curator" | "finance" | "distributor";
export type PaymentDetailStatus = 'pending' | 'in_progress' | 'verified' | 'failed';
export type PayoutMethod = 'upi' | 'bank_transfer';
export type VerificationStatus = 'pending' | 'manual_review' | 'verified' | 'suspended' | 'banned';
export type QuestionStatus = 'pending' | 'held' | 'approved' | 'rejected' | 'moved_to_final';
export type UserCategory = 'farmer' | 'fpo' | 'student' | 'volunteer' | 'ngo';

export interface User {
  id: string;
  mobileNumber: string;
  name: string;
  username: string | null;
  role: UserRole;
  category: UserCategory | null;
  state: string;
  district: string;
  block: string | null;
  village: string | null;
  kvk: string | null;
  /** Organisation type for fpo / volunteer / ngo users */
  organisationType: string | null;
  languagePreference: string;
  // Flattened profile fields (replacing profileData JSONB)
  age:              number | null;
  gender:           string | null;
  farmSize:         string | null;
  season:           string | null;
  cropType:         string | null;
  courseName:       string | null;
  collegeName:      string | null;
  universityName:   string | null;
  organizationName:     string | null;
  organizationRole:     string | null;
  organizationState:    string | null;
  organizationDistrict: string | null;
  organizationBlock:    string | null;
  organizationVillage:  string | null;
  numberOfFarmers:      number | null;
  verificationStatus: VerificationStatus;
  suspendedAt: string | null;
  suspendedUntil: string | null;
  suspendedReason: string | null;
  bannedAt: string | null;
  bannedReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  consentGiven: boolean;
  /** Crop names stored as a string array on the user record */
  crops: string[];
}


export interface PaymentDetail {
  id: string;
  payoutMethod: PayoutMethod;
  status: PaymentDetailStatus;
  /** Masked value: "****1234" for bank, or the UPI ID itself */
  displayValue: string;
  bankName: string | null;
  ifsc: string | null;
  accountHolderName: string | null;
  verifiedAt: string | null;
  createdAt: string;
  paymentLinkUrl?: string;
}

export interface Question {
  id: string;
  userId: string;
  questionText: string;
  status: QuestionStatus;
  domains: string[];
  season: string;
  cropType: string;
  state: string;
  district: string;
  block: string | null;
  village: string | null;
  language: string;
  mediaType: string;
  mediaUrls: string[] | null;
  duplicateFlag: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy?: string | null;
  reviewedByName?: string | null;
  /** Reason provided when the question was rejected — required for rejection */
  rejectionReason: string | null;
  /** Reason provided when the question was approved — required for approval */
  approvalReason: string | null;
  /** Reason provided when the question was put on hold — required for hold */
  heldReason: string | null;
  reviewerId?: string | null;
  /** Populated user info returned by backend */
  user?: {
    id: string;
    name: string;
    mobileNumber?: string;
  } | null;
  /** Alias for user.name, returned by some endpoints */
  userName?: string | null;
  /** Alias for user.mobileNumber */
  userMobileNumber?: string | null;
}

export interface DashboardStats {
  totalUsers: number;
  verifiedUsers: number;
  pendingUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  totalQuestions: number;
  pendingQuestions: number;
  approvedQuestions: number;
  rejectedQuestions: number;
  questionsThisWeek: number;
  usersThisWeek: number;
}

export interface AccountLockedInfo {
  status: 'suspended' | 'banned';
  reason: string | null;
  suspendedAt: string | null;
  bannedAt: string | null;
  suspendedUntil: string | null;
}

export interface AuthUser {
  id: string;
  mobileNumber: string;
  name: string;
  role: UserRole;
  token: string;
  // Additional fields returned from /auth/me and /auth/verify-otp
  category?: UserCategory | null;
  state?: string;
  district?: string;
  block?: string | null;
  village?: string | null;
  languagePreference?: string;
  verificationStatus?: VerificationStatus;
  createdAt?: string;
  organizationState?:    string | null;
  organizationDistrict?: string | null;
  organizationBlock?:    string | null;
  organizationVillage?:  string | null;
}

export type TimeRange = '7d' | '30d' | '90d'

export interface DailyStat {
  date: string
  users: number
  questions: number
  signups: number
  approved: number
  rejected: number
}

export interface AdminStats {
  dashboard: DashboardStats;
  recentActivity: ActivityLogEntry[];
  roleDistribution: { role: UserRole; count: number }[];
  categoryDistribution: { category: UserCategory; count: number }[];
  historical?: DailyStat[];
  avgReviewTurnaroundMinutes: number | null;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  description: string;
  performedBy: string;
  performedAt: string;
  targetUser?: string;
}

export interface ConfigItem {
  key: string
  value: number
  description?: string
}

export interface WithdrawalUser {
  id: string
  name: string
  mobileNumber: string
  state: string
}

export interface PaymentLogEntry {
  id: string
  orderId: string
  pinelabsTransactionId: string | null
  razorpayPayoutId: string | null
  utrNumber: string | null
  razorpayPayoutId: string | null
  status: 'initiated' | 'success' | 'failed' | 'pending'
  errorCode: string | null
  errorMessage: string | null
  rawResponse: Record<string, unknown> | null
  attemptedAt: string
}

export interface Withdrawal {
  id: string
  amount: number
  payoutMethod: string
  payoutDetails: Record<string, unknown> | null
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'failed'
  retryCount: number
  createdAt: string
  processedAt: string | null
  rejectionReason: string | null
  failureReason: string | null
  utrNumber: string | null
  razorpayPayoutId: string | null
  user: WithdrawalUser | null
  paymentLogs?: PaymentLogEntry[]
}

export interface WalletSummary {
  id: string
  userId: string
  balance: number
  totalEarned: number
  totalWithdrawn: number
  user: {
    id: string
    name: string
    mobileNumber: string
    state: string
    category: string
    role: string
    verificationStatus: string
    createdAt: string
  }
}

export interface Transaction {
  id: string
  amount: number
  type: 'credit' | 'debit'
  source: 'reward' | 'withdrawal' | 'refund' | 'adjustment'
  description: string | null
  rejectionReason: string | null
  status: 'pending' | 'completed' | 'failed' | 'reversed'
  referenceId: string | null
  balanceAfter: number | null
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  type: string
  triggerType: string
  title: string
  body: string
  data: Record<string, unknown> | null
  isRead: boolean
  createdAt: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

// ─── Analytics (Task 11) ────────────────────────────────────────────────────────

export interface SignupTrendPoint {
  date: string
  signups: number
  dau: number
}

export interface UserAnalytics {
  totalUsers: number
  mau: number
  dau: number
  signupGrowth: number
  signupTrend: SignupTrendPoint[]
  stateBreakdown: { state: string; count: number }[]
  districtBreakdown: { district: string; state: string; count: number }[]
  categoryBreakdown: { category: UserCategory; count: number }[]
  roleDistribution: { role: UserRole; count: number }[]
}

export interface QuestionSummary {
  total: number
  approved: number
  rejected: number
  pending: number
  approvalRate: number
  growthRate: number
}

export interface QuestionAnalytics {
  summary: QuestionSummary
  dailyVolume: { date: string; submitted: number; approved: number; rejected: number }[]
  stateBreakdown: { state: string; count: number; approved: number }[]
  districtBreakdown: { district: string; state: string; count: number; approved: number }[]
  cropBreakdown: { cropType: string; count: number; approved: number }[]
  domainBreakdown: { domain: string; count: number; approved: number }[]
}

export interface RewardAnalytics {
  totalRewarded: number
  rewardCount: number
  avgReward: number
  totalPool: number
  dailyRewardTrend: { date: string; amount: number; count: number }[]
  withdrawals: {
    totalWithdrawn: number
    withdrawalCount: number
    pending: number
    completed: number
    failed: number
  }
}

export interface AnalyticsDashboard {
  // Key metric cards
  totalRegisteredUsers: number
  monthlyActiveUsers: number
  totalApprovedQuestions: number
  totalRewarded: number
  datasetGrowthRate: number
  costPerApprovedQuestion: number
  stateParticipationRate: number
  // Sub-sections
  users: UserAnalytics
  questions: QuestionAnalytics
  rewards: RewardAnalytics
}

export interface ExportParams {
  fromDate?: string
  toDate?: string
  state?: string
  cropType?: string
  domains?: string[]
  dataType?: 'questions' | 'users' | 'rewards' | 'withdrawals'
  format?: 'csv' | 'excel'
}

// ─── Audit Logs (Task 19) ──────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  actorType: 'admin' | 'curator' | 'user' | 'system'
  actorId: string | null
  actorName: string | null
  actorRole: string | null
  action: string
  entityType: string | null
  entityId: string | null
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface AuditLogsResponse {
  items: AuditLogEntry[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface ActorStats {
  actorId: string
  actorName: string
  actorRole: string
  withdrawalApproved: number
  withdrawalRejected: number
  withdrawalProcessed: number
  withdrawalRetried: number
  userSuspended: number
  userBanned: number
  userUnsuspended: number
  userUnbanned: number
  userVerified: number
  questionApproved: number
  questionRejected: number
  questionHeld: number
  configUpdated: number
  totalActions: number
}

export interface AuditStatsResponse {
  fromDate: string | null
  toDate: string | null
  actors: ActorStats[]
  summary: {
    totalActions: number
    uniqueActors: number
    mostActiveActor: string | null
    mostActiveActorName: string | null
  }
}

export interface AuditSummarySeries {
  date: string
  withdrawals: number
  userActions: number
  questionReviews: number
  configChanges: number
  total: number
}

export interface AuditSummaryResponse {
  granularity: 'day' | 'week' | 'month'
  series: AuditSummarySeries[]
}

export interface AuditEntityHistoryResponse {
  entityType: string
  entityId: string
  entries: AuditLogEntry[]
}

export interface AuditLogQuery {
  page?: number
  limit?: number
  actorId?: string
  actorType?: string
  /** Filter actors by role: admin | curator | finance — super_admin can see any role */
  role?: 'admin' | 'curator' | 'finance'
  action?: string
  actions?: string[]
  entityType?: string
  entityId?: string
  fromDate?: string
  toDate?: string
  search?: string
  sortBy?: 'createdAt' | 'action' | 'actorId'
  sortOrder?: 'ASC' | 'DESC'
}

export interface AuditUserSummary {
  id: string
  name: string
  mobileNumber: string
  role: string
}

export interface AuditUsersByRoleResponse {
  users: AuditUserSummary[]
}

// ─── Curator Dashboard ─────────────────────────────────────────────────────────

export interface QueueStatusCount {
  status: QuestionStatus
  label: string
  count: number
}

export interface CuratorStats {
  queue: {
    total: number
    breakdown: QueueStatusCount[]
  }
  volume: {
    today: number
    thisWeek: number
    thisMonth: number
    last30Days: number
  }
  performance: {
    approved30Days: number
    rejected30Days: number
    approvalRate: number
    priorApprovalRate: number
    approvalRateChange: number
    avgReviewTurnaroundMinutes: number | null
  }
  growth: {
    last30Days: number
    prior30Days: number
    growthRate: number
  }
  dailyVolume: Array<{
    date: string
    submitted: number
    approved: number
    rejected: number
    held: number
  }>
  cropBreakdown: Array<{ cropType: string; count: number }>
  stateBreakdown: Array<{ state: string; count: number }>
  domainBreakdown: Array<{ domain: string; count: number }>
}

export interface CuratorReviewerStats {
  week: {
    from: string
    to: string
    approved: number
    rejected: number
    held: number
    total: number
    approvalRate: number
    pending: number
  }
}

export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type ReportCategory = 'bug' | 'payout_issue' | 'question_issue' | 'abuse' | 'feature_request' | 'other';
export type ReportPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Report {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: ReportCategory;
  status: ReportStatus;
  priority: ReportPriority;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Pick<User, 'id' | 'name' | 'mobileNumber'>;
  replies?: ReportReply[];
}

export interface ReportReply {
  id: string;
  reportId: string;
  adminId: string;
  message: string;
  createdAt: string;
  admin?: Pick<User, 'id' | 'name'>;
}

export type FaqCategory = 'account' | 'payment' | 'question' | 'general';

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: FaqCategory;
  isVisible: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Distributor (final-questions distribution) ──────────────────────────

/**
 * Distributed copy of an approved question into a specific Indian state.
 *
 * Each row carries a denormalized snapshot of the original `Question` so
 * the row is self-contained — readers do NOT need to fetch the source
 * question to see its full context (language, asker's home state, media,
 * etc.).
 *
 * Field-naming collisions with the source `Question`:
 *   - `distributionState` ↔ the *target* Indian state this row is being
 *     distributed to.
 *   - `state` (embedded below) ↔ the *asker's home* state, copied from
 *     `Question.state`.
 *   - `createdAt` / `updatedAt` ↔ distribution timestamps (when this row
 *     was created/updated). The source question's `createdAt` / `updatedAt`
 *     are NOT preserved on this row.
 *   - `referenceQuestionId` ↔ FK to the source `Question._id`.
 */
export interface FinalQuestion {
  id: string;

  // ── Reference back to the source question ─────────────────────────────────
  referenceQuestionId: string;

  // ── Distribution-side fields ──────────────────────────────────────────────
  /**
   * Target Indian state this row is being distributed to.
   *
   * `null` for the canonical reference doc (the "original question" row that
   * is written the very first time a question is distributed to any state).
   * For every state-specific child row this is a non-null Indian state name.
   */
  distributionState: string | null;
  distributorId: string;
  /**
   * Resolved display info for the distributor that performed this assignment.
   * Backed by `users._id` → `users.name` / `users.username` lookup done on
   * the server in `DistributorService.listDistributions` so the UI does not
   * have to render a raw ObjectId. `null` if the user has been deleted or
   * the lookup otherwise failed (client should fall back to a truncated id).
   */
  distributor?: {
    id: string;
    name: string;
    username: string | null;
  } | null;
  notes: string | null;
  isActive: boolean;
  /** True on the canonical reference doc; false on every state-specific child row. */
  isReference: boolean;
  /** FK -> final_questions._id of this row's canonical reference doc. `null` on the reference doc itself. */
  parentReferenceId: string | null;

  // ── Snapshot of the source Question (denormalized copy) ───────────────────
  userId: string | null;
  language: string;
  domains: string[];
  season: string | null;
  cropType: string | null;
  agroClimaticZone: string | null;
  /** Asker's HOME state — distinct from `distributionState` above. */
  state: string | null;
  district: string | null;
  block: string | null;
  questionText: string;
  /** Vector embedding — copied from Question. May be large. */
  embedding: number[] | null;
  mediaType: string | null;
  mediaUrls: string[] | null;
  deviceInfo: Record<string, unknown> | null;
  /** Source question's status at the time of distribution. */
  status: string | null;
  duplicateFlag: boolean;
  duplicateOfId: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewerId: string | null;
  rejectionReason: string | null;
  heldReason: string | null;
  approvalReason: string | null;

  // ── Distribution timestamps ───────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
}

export interface DistributorStats {
  indianStatesTotal: number;
  byState: { state: string; count: number }[];
}