// User enums
export enum UserCategory {
  FARMER = "farmer",
  FPO = "fpo",
  STUDENT = "student",
  VOLUNTEER = "volunteer",
  NGO = "ngo",
  ANVESHAN_USER = "anveshan_user",
}

export enum PaymentDetailVerificationStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  VERIFIED = "verified",
  FAILED = "failed",
}

export enum VerificationStatus {
  PENDING = "pending",
  MANUAL_REVIEW = "manual_review",
  VERIFIED = "verified",
  SUSPENDED = "suspended",
  BANNED = "banned",
}

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  SUPER_ADMIN = "super_admin",
  CURATOR = "curator",
  FINANCE = "finance",
  DISTRIBUTOR = "distributor",
}

export enum QuestionStatus {
  PENDING = "pending",
  HELD = "held",
  APPROVED = "approved",
  REJECTED = "rejected",
  MOVED_TO_FINAL = "moved_to_final",
}

export enum MediaType {
  NONE = "none",
  IMAGE = "image",
  VIDEO = "video",
  AUDIO = "audio",
}

export enum Season {
  // Indian agricultural seasons
  KHARIF = "Kharif",
  RABI = "Rabi",
  ZAID = "Zaid",
  // Indian sub-seasons
  PRE_KHARIF = "Pre-Kharif",
  POST_KHARIF = "Post-Kharif",
  PRE_RABI = "Pre-Rabi",
  ZAID_RABI = "Zaid Rabi",
  // General/global seasons
  SPRING = "Spring",
  SUMMER = "Summer",
  AUTUMN = "Autumn",
  WINTER = "Winter",
  MONSOON = "Monsoon",
  DRY_SEASON = "Dry Season",
  WET_SEASON = "Wet Season",
}

export enum TransactionType {
  CREDIT = "credit",
  DEBIT = "debit",
}

export enum TransactionSource {
  REWARD = "reward",
  WITHDRAWAL = "withdrawal",
  VERIFICATION_CHARGE = "verification_charge",
  REFUND = "refund",
  ADJUSTMENT = "adjustment",
}

export enum TransactionStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  FAILED = "failed",
  REVERSED = "reversed",
  REJECTED = "rejected",
}

export enum PayoutMethod {
  UPI = "upi",
  BANK_TRANSFER = "bank_transfer",
}

export enum WithdrawalStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
  FAILED = "failed",
  REVERSED = "reversed",
}

export enum PaymentLogStatus {
  SUCCESS = "success",
  FAILED = "failed",
  PENDING = "pending",
  REVERSED = "reversed",
}

export enum ViolationType {
  DUPLICATE = "duplicate",
  SPAM = "spam",
  ABUSE = "abuse",
}

export enum PenaltyType {
  WARNING = "warning",
  SUSPENSION = "suspension",
  BAN = "ban",
}

export enum VerificationTriggerType {
  USER_ADD = "user_add",
  USER_EDIT = "user_edit",
  WITHDRAWAL_VERIFY = "withdrawal_verify",
}

export enum ReportStatus {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  RESOLVED = "resolved",
  CLOSED = "closed",
}

export enum ReportCategory {
  BUG = "bug",
  PAYOUT_ISSUE = "payout_issue",
  QUESTION_ISSUE = "question_issue",
  ABUSE = "abuse",
  FEATURE_REQUEST = "feature_request",
  OTHER = "other",
}

export enum ReportPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export type FaqCategory = "account" | "payment" | "question" | "general";

export enum NotificationType {
  QUESTION_APPROVED = "question_approved",
  QUESTION_REJECTED = "question_rejected",
  QUESTION_HELD = "question_held",
  QUESTION_INFO_REQUESTED = "question_info_requested",
  DUPLICATE_QUESTION = "duplicate_question",
  REWARD_CREDITED = "reward_credited",
  WITHDRAWAL_APPROVED = "withdrawal_approved",
  WITHDRAWAL_REJECTED = "withdrawal_rejected",
  WITHDRAWAL_FAILED = "withdrawal_failed",
  REFUND_COMPLETED = "refund_completed",
  ACCOUNT_SUSPENDED = "account_suspended",
  ACCOUNT_BANNED = "account_banned",
  GENERAL = "general",
  REPORT_REPLY = "report_reply",
  REPORT_CLOSED = "report_closed",
}

export enum NotificationTriggerType {
  QUESTION = "question",
  WITHDRAW = "withdraw",
  REPORT = "report",
  SYSTEM = "system",
}

export enum AuditAction {
  // User
  USER_SESSION_REVOKED = "user_session_revoked",
  USER_DELETED= 'user_deleted',
  USER_RESTORED= 'user_restored',
  USER_SUSPENDED = "user_suspended",
  USER_BANNED = "user_banned",
  USER_UNSUSPENDED = "user_unsuspended",
  USER_UNBANNED = "user_unbanned",
  USER_VERIFIED = "user_verified",
  USER_CREATED = "user_created",
  CONFIG_UPDATED = "config_updated",
  QUESTION_APPROVED = "question_approved",
  QUESTION_REJECTED = "question_rejected",
  QUESTION_DISTRIBUTED = "question_distributed",
  HOLD_QUESTION = "hold_question",
  REQUEST_INFO = "request_info",
  REWARD_CREDITED = "reward_credited",
  WITHDRAWAL_REQUESTED = "withdrawal_requested",
  WITHDRAWAL_COMPLETED = "withdrawal_completed",

  REPORT_REPLIED = "report_replied",
  UPDATE_REPORT = "update_report",
  REPORT_STATUS_CHANGED = "report_status_changed",
  CREATE_FAQ = "create_faq",
  UPDATE_FAQ= "update_faq",
  DELETE_FAQ= "delete_faq",
  TRANSLATE_QUESTION = "translate_question",
  WITHDRAWAL_PROCESSED = "withdrawal_processed",
  WITHDRAWAL_RETRIED = "withdrawal_retried",
  WITHDRAWAL_REFUND_RETRIED = "withdrawal_refund_retried",
  WITHDRAWAL_FAILED = "withdrawal_failed",
  WITHDRAWAL_FAILURE_REASON_UPDATED = "withdrawal_failure_reason_updated",
  WALLET_ADJUSTED = "wallet_adjusted",
  CACHE_FLUSHED = "cache_flushed",
}

export enum ActorType {
	ADMIN= 'admin',
	SUPER_ADMIN= 'super_admin',
	DISTRIBUTOR= 'distributor',
	FINANCE= 'finance',
	CURATOR= 'curator',
  USER = 'user'
}



export enum OutcomeStatus {
  SUCCESS = "success",
  FAILURE = "failure",
  PARTIAL = "partial",
}

/**
 * Reason a question submission was blocked by the GDB safety / relevance
 * pre-check. Clients map these to a translated message.
 */
export enum QuestionRejectionCategory {
  ABUSIVE = "ABUSIVE",
  NOT_AGRICULTURE = "NOT_AGRICULTURE",
  OTHER = "OTHER",
}

/** Kind of reference record a user can submit alongside questions. */
export enum AgriEntityType {
  CROP = "crop",
  WEED = "weed",
  PEST = "pest",
  DISEASE = "disease",
}

/** Review lifecycle of a submitted crop, weed, pest or disease record. */
export enum AgriEntityStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}
