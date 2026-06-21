// User enums
export enum UserCategory {
  FARMER = 'farmer',
  FPO = 'fpo',
  STUDENT = 'student',
  VOLUNTEER = 'volunteer',
  NGO = 'ngo',
}

export enum PaymentDetailVerificationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  VERIFIED = 'verified',
  FAILED = 'failed',
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

export enum ActorType {
  USER = 'user',
  ADMIN = 'admin',
  CURATOR = 'curator',
  SYSTEM = 'system',
}

export enum QuestionStatus {
  PENDING = 'pending',
  AI_REVIEW = 'ai_review',
  HUMAN_REVIEW = 'human_review',
  HELD = 'held',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum MediaType {
  NONE = 'none',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
}

export enum Season {
  // Indian agricultural seasons
  KHARIF = 'Kharif',
  RABI = 'Rabi',
  ZAID = 'Zaid',
  // Indian sub-seasons
  PRE_KHARIF = 'Pre-Kharif',
  POST_KHARIF = 'Post-Kharif',
  PRE_RABI = 'Pre-Rabi',
  ZAID_RABI = 'Zaid Rabi',
  // General/global seasons
  SPRING = 'Spring',
  SUMMER = 'Summer',
  AUTUMN = 'Autumn',
  WINTER = 'Winter',
  MONSOON = 'Monsoon',
  DRY_SEASON = 'Dry Season',
  WET_SEASON = 'Wet Season',
}

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum TransactionSource {
  REWARD = 'reward',
  WITHDRAWAL = 'withdrawal',
  VERIFICATION_CHARGE = 'verification_charge',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
  REJECTED = 'rejected',
}

export enum PayoutMethod {
  UPI = 'upi',
  BANK_TRANSFER = 'bank_transfer',
}

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

export enum PaymentLogStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

export enum ViolationType {
  DUPLICATE = 'duplicate',
  SPAM = 'spam',
  ABUSE = 'abuse',
}

export enum PenaltyType {
  WARNING = 'warning',
  SUSPENSION = 'suspension',
  BAN = 'ban',
}

export enum VerificationTriggerType {
  USER_ADD = 'user_add',
  USER_EDIT = 'user_edit',
  WITHDRAWAL_VERIFY = 'withdrawal_verify',
}

export enum AuditAction {
  // Auth
  OTP_REQUESTED = 'otp_requested',
  OTP_VERIFIED = 'otp_verified',
  OTP_EXPIRED = 'otp_expired',
  // User
  USER_REGISTERED = 'user_registered',
  USER_PROFILE_UPDATED = 'user_profile_updated',
  USER_SUSPENDED = 'user_suspended',
  USER_BANNED = 'user_banned',
  USER_UNSUSPENDED = 'user_unsuspended',
  USER_UNBANNED = 'user_unbanned',
  USER_VERIFIED = 'user_verified',
  // Questions
  QUESTION_SUBMITTED = 'question_submitted',
  QUESTION_APPROVED = 'question_approved',
  QUESTION_REJECTED = 'question_rejected',
  // Wallet
  REWARD_CREDITED = 'reward_credited',
  WITHDRAWAL_REQUESTED = 'withdrawal_requested',
  WITHDRAWAL_COMPLETED = 'withdrawal_completed',
  // Admin
  ADMIN_CONFIG_UPDATED = 'admin_config_updated',
}