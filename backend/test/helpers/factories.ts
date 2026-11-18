import { Types } from 'mongoose';
import { UserRole, VerificationStatus } from '../../src/shared/classes/enums';

// Returns a fresh 24 character hex id, the format every Mongo foreign key uses.
export const objectId = (): string => new Types.ObjectId().toHexString();

export interface TestUser {
  _id: Types.ObjectId;
  name: string;
  mobileNumber: string;
  role: UserRole;
  tokenVersion: number;
  verificationStatus: VerificationStatus;
  isDeleted: boolean;
  isAnveshanUser: boolean;
  suspendedReason: string | null;
  suspendedAt: Date | null;
  suspendedUntil: Date | null;
  bannedReason: string | null;
  bannedAt: Date | null;
}

// Builds a persisted user document with safe defaults that tests override per case.
export function buildUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    _id: new Types.ObjectId(),
    name: 'Test Farmer',
    mobileNumber: '+919876543210',
    role: UserRole.USER,
    tokenVersion: 1,
    verificationStatus: VerificationStatus.VERIFIED,
    isDeleted: false,
    isAnveshanUser: false,
    suspendedReason: null,
    suspendedAt: null,
    suspendedUntil: null,
    bannedReason: null,
    bannedAt: null,
    ...overrides,
  };
}
