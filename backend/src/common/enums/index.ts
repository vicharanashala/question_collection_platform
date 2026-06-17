// User enums
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
  KHARIF = 'kharif',
  RABI = 'rabi',
  ZAID = 'zaid',
  YEAR_ROUND = 'year_round',
}

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum TransactionSource {
  REWARD = 'reward',
  WITHDRAWAL = 'withdrawal',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export enum PayoutMethod {
  UPI = 'upi',
  BANK_TRANSFER = 'bank_transfer',
}

export enum WithdrawalStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
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