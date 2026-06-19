// ─── Enums ────────────────────────────────────────────────────────────────────

export enum UserCategory {
  FARMER = 'farmer',
  FPO = 'fpo',
  STUDENT = 'student',
  VOLUNTEER = 'volunteer',
  NGO = 'ngo',
}

export enum VerificationStatus {
  PENDING = 'pending',
  MANUAL_REVIEW = 'manual_review',
  VERIFIED = 'verified',
  SUSPENDED = 'suspended',
  BANNED = 'banned',
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  CURATOR = 'curator',
}

export enum CropSeason {
  KHARIF = 'kharif',
  RABI = 'rabi',
  ZAID = 'zaid',
  YEAR_ROUND = 'year_round',
}

// ─── API Types ─────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PublicUser {
  id: string;
  mobileNumber: string;
  name: string;
  category: UserCategory;
  state: string;
  district: string;
  block: string | null;
  languagePreference: string;
  verificationStatus: VerificationStatus;
  role: UserRole;
  createdAt: string;
  // Category-specific fields — stored in profileData JSONB on backend
  profileData?: Record<string, string>;
  // Crop details (populated from /users/me)
  crops?: CropDetail[];
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: PublicUser;
}

export interface RegisterResponse {
  requiresRegistration?: boolean;
  tempToken?: string;
}

export interface WalletBalance {
  balance: number;
  currency: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: 'credit' | 'debit';
  source: 'reward' | 'withdrawal' | 'refund' | 'adjustment';
  amount: number | string;
  balanceAfter: number | string;
  referenceId: string | null;
  description: string | null;
  status: 'pending' | 'completed' | 'failed' | 'reversed' | 'rejected';
  createdAt: string;
}

export interface Question {
  id: string;
  language: string;
  domains: string[];
  season: string;
  cropType: string;
  state: string;
  district: string;
  block: string | null;
  questionText: string;
  mediaType: 'none' | 'image' | 'video' | 'audio';
  mediaUrls: string[] | null;
  status: 'pending' | 'ai_review' | 'human_review' | 'held' | 'approved' | 'rejected';
  aiConfidenceScore: number | null;
  duplicateFlag: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  heldReason: string | null;
  approvalReason: string | null;
  reviewedByName: string | null;
}

export interface CropDetail {
  id: string;
  cropName: string;
  season: CropSeason | string | null;
}

// ─── Profile Completion ───────────────────────────────────────────────────────

export interface ProfileFieldStatus {
  field: string;
  label: string;
  completed: boolean;
}

export interface ProfileCompletionStatus {
  percentage: number;
  fields: ProfileFieldStatus[];
  isComplete: boolean;
}

// ─── Form DTOs ─────────────────────────────────────────────────────────────────

export interface RegisterFormData {
  name: string;
  mobileNumber: string;
  state: string;
  district: string;
  block?: string;
  category: UserCategory;
  languagePreference: string;
  consentGiven: boolean;
  // Farmer
  farmSize?: string;
  cropType?: string;
  // Student
  courseName?: string;
  universityName?: string;
  // FPO / Volunteer / NGO
  organizationName?: string;
  role?: string;
}

export interface WalletSummary {
  id: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    mobileNumber: string;
    category: string;
    role: string;
    verificationStatus: string;
    state: string;
    district?: string;
  } | null;
}

export interface WithdrawalFormData {
  amount: number;
  payoutMethod: 'upi' | 'bank_transfer';
  payoutDetails: {
    upiId?: string;
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export enum NotificationType {
  QUESTION_APPROVED = 'question_approved',
  QUESTION_REJECTED = 'question_rejected',
  QUESTION_HELD = 'question_held',
  QUESTION_INFO_REQUESTED = 'question_info_requested',
  REWARD_CREDITED = 'reward_credited',
  WITHDRAWAL_APPROVED = 'withdrawal_approved',
  WITHDRAWAL_REJECTED = 'withdrawal_rejected',
  ACCOUNT_SUSPENDED = 'account_suspended',
  ACCOUNT_BANNED = 'account_banned',
}

export enum NotificationTriggerType {
  QUESTION = 'question',
  WITHDRAW = 'withdraw',
}

export interface AppNotification {
  id: string;
  userId: string;
  notificationType: NotificationType;
  /** 'question' | 'withdraw' — which feature area triggered this notification */
  triggerType: NotificationTriggerType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unread: number;
  total: number;
}

// ─── Analytics (Task 11) ──────────────────────────────────────────────────────

export type TimeRange = '7d' | '30d' | '90d';

export interface SignupTrendPoint {
  date: string;
  signups: number;
  dau: number;
}

export interface UserAnalytics {
  totalUsers: number;
  mau: number;
  dau: number;
  signupGrowth: number;
  signupTrend: SignupTrendPoint[];
  stateBreakdown: { state: string; count: number }[];
  categoryBreakdown: { category: string; count: number }[];
  roleDistribution: { role: string; count: number }[];
}

export interface QuestionSummary {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  approvalRate: number;
  growthRate: number;
}

export interface QuestionAnalytics {
  summary: QuestionSummary;
  avgAiConfidence: number | null;
  dailyVolume: { date: string; submitted: number; approved: number; rejected: number }[];
  stateBreakdown: { state: string; count: number; approved: number }[];
  cropBreakdown: { cropType: string; count: number; approved: number }[];
  domainBreakdown: { domain: string; count: number; approved: number }[];
}

export interface RewardAnalytics {
  totalRewarded: number;
  rewardCount: number;
  avgReward: number;
  totalPool: number;
  dailyRewardTrend: { date: string; amount: number; count: number }[];
  withdrawals: {
    totalWithdrawn: number;
    withdrawalCount: number;
    pending: number;
    completed: number;
    failed: number;
  };
}

export interface AnalyticsDashboard {
  totalRegisteredUsers: number;
  monthlyActiveUsers: number;
  totalApprovedQuestions: number;
  totalRewarded: number;
  datasetGrowthRate: number;
  costPerApprovedQuestion: number;
  stateParticipationRate: number;
  avgQuestionQualityScore: number | null;
  users: UserAnalytics;
  questions: QuestionAnalytics;
  rewards: RewardAnalytics;
}