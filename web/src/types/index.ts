export type UserRole = 'user' | 'admin' | 'super_admin' | 'curator';
export type PaymentDetailStatus = 'pending' | 'in_progress' | 'verified' | 'failed';
export type PayoutMethod = 'upi' | 'bank_transfer';
export type VerificationStatus = 'pending' | 'manual_review' | 'verified' | 'suspended' | 'banned';
export type QuestionStatus = 'pending' | 'ai_review' | 'human_review' | 'held' | 'approved' | 'rejected';
export type UserCategory = 'farmer' | 'fpo' | 'student' | 'volunteer' | 'ngo';

export interface User {
  id: string;
  mobileNumber: string;
  name: string;
  role: UserRole;
  category: UserCategory | null;
  state: string;
  district: string;
  block: string | null;
  village: string | null;
  languagePreference: string;
  verificationStatus: VerificationStatus;
  suspendedAt: string | null;
  suspendedUntil: string | null;
  suspendedReason: string | null;
  bannedAt: string | null;
  bannedReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
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
  user: WithdrawalUser | null
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