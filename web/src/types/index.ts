export type UserRole = 'user' | 'admin' | 'super_admin' | 'curator';
export type VerificationStatus = 'pending' | 'manual_review' | 'verified' | 'suspended' | 'banned';
export type QuestionStatus = 'pending' | 'ai_review' | 'human_review' | 'approved' | 'rejected';
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

export interface Question {
  id: string;
  userId: string;
  questionText: string;
  status: QuestionStatus;
  domainCategory: string;
  season: string;
  cropType: string;
  state: string;
  district: string;
  block: string | null;
  language: string;
  mediaType: string;
  mediaUrls: string[] | null;
  aiConfidenceScore: number | null;
  duplicateFlag: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason?: string | null;
  reviewerId?: string | null;
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
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  processedAt: string | null
  failureReason: string | null
  user: WithdrawalUser | null
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}