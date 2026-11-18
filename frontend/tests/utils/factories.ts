import type { AuthUser } from '@/types'

// Builds a signed-in public user with a completed profile; tests override what they need.
export function buildAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    mobileNumber: '+919876543210',
    name: 'Ramesh Kumar',
    username: 'ramesh',
    role: 'user',
    token: 'access-token',
    category: 'farmer',
    consentGiven: true,
    verificationStatus: 'verified',
    isAnveshanUser: false,
    ...overrides,
  }
}
