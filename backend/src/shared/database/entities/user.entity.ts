export { VerificationStatus, UserCategory, UserRole } from '../../classes/enums';
import { VerificationStatus, UserCategory, UserRole } from '../../classes/enums';
import { Wallet } from './wallet.entity';
import { Question } from './question.entity';
import { WithdrawalRequest } from './withdrawal-request.entity';
import { Notification } from './notification.entity';
import { Report } from './report.entity';

export interface User {
  id: string;

  mobileNumber: string;

  username: string | null;

  name: string;

  role: UserRole;

  category: UserCategory | null;

  organisationType: string | null;

  state: string;

  district: string;

  block: string | null;

  village: string | null;

  kvk: string | null;

  languagePreference: string;

  tokenVersion: number;

  otpHash: string | null;

  otpExpiresAt: Date | null;

  verificationStatus: VerificationStatus;

  suspendedAt: Date | null;

  suspendedUntil: Date | null;

  suspendedReason: string | null;

  bannedAt: Date | null;

  bannedReason: string | null;

  profileData: Record<string, unknown> | null;

  /** Age — applicable to all categories */
  age: number | null;

  /** Gender — applicable to all categories */
  gender: string | null;

  /** Farm size in acres — farmer only */
  farmSize: string | null;

  /** Farming season — farmer / volunteer */
  season: string | null;

  /** Primary crop — farmer / volunteer */
  cropType: string | null;

  /** Student's course name */
  courseName: string | null;

  /** Student's college name */
  collegeName: string | null;

  /** Student's university name */
  universityName: string | null;

  /** Organisation name — fpo / ngo / volunteer */
  organizationName: string | null;

  /** Role within the organisation — fpo / ngo / volunteer */
  organizationRole: string | null;

  /** Number of farmers under this FPO/NGO — fpo / ngo only */
  numberOfFarmers: number | null;

  /**
   * Organisation state(s) — fpo / ngo / volunteer.
   * An organisation can operate in multiple Indian states, so this is stored
   * as an array.
   */
  organizationState: string[] | null;

  /** Organisation district — fpo / ngo / volunteer */
  organizationDistrict: string | null;

  /** Organisation block — fpo / ngo / volunteer */
  organizationBlock: string | null;

  /** Organisation village — fpo / ngo / volunteer */
  organizationVillage: string | null;

  consentGiven: boolean;

  consentTimestamp: Date | null;

  createdAt: Date;

  updatedAt: Date;

  lastLoginAt: Date | null;

  expoPushToken: string | null;

  /** RazorpayX Contact ID — created once per user, reused for all fund accounts and payouts */
  razorpayContactId: string | null;

  /** Crop names selected by the user (no season) */
  crops: string[];

  wallet: Wallet;

  questions: Question[];

  withdrawalRequests: WithdrawalRequest[];

  notifications: Notification[];

  reports: Report[];

  isUserCreatedBySuperAdmin: boolean

  profileCreatedByAdminCompleted: boolean

  isAnveshanUser: boolean

  is_tester?: boolean
}