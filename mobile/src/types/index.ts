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
  type: 'credit' | 'debit';
  source: 'reward' | 'withdrawal' | 'refund' | 'adjustment';
  amount: number;
  balanceAfter: number;
  description: string | null;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  createdAt: string;
}

export interface Question {
  id: string;
  language: string;
  domainCategory: string;
  season: string;
  cropType: string;
  state: string;
  district: string;
  block: string | null;
  questionText: string;
  mediaType: 'none' | 'image' | 'video' | 'audio';
  mediaUrls: string[] | null;
  status: 'pending' | 'ai_review' | 'human_review' | 'approved' | 'rejected';
  aiConfidenceScore: number | null;
  duplicateFlag: boolean;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export interface CropDetail {
  id: string;
  cropName: string;
  season: string | null;
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