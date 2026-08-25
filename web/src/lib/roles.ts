import type { AuthUser } from '@/types'

/**
 * Role constants for clarity across the app.
 * Ordered from least to most privileged.
 */
export type Role = 'user' | 'curator' | 'finance' | 'distributor' | 'admin' | 'super_admin'

export const ROLE_HIERARCHY: Record<Role, number> = {
  user: 0,
  curator: 1,
  finance: 2,
  distributor: 3,
  admin: 4,
  super_admin: 5,
}

/** Returns true if currentUser is super_admin */
export function isSuperAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === 'super_admin'
}

/** Returns true if currentUser is admin or super_admin */
export function isAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin'
}

/** Returns true if currentUser is curator, admin, or super_admin (can review) */
export function isCuratorOrAbove(user: AuthUser | null | undefined): boolean {
  return user?.role === 'curator' || user?.role === 'admin' || user?.role === 'super_admin'
}

/** Returns true if currentUser is finance, admin, or super_admin (can manage finances) */
export function isFinanceOrAbove(user: AuthUser | null | undefined): boolean {
  return user?.role === 'finance' || user?.role === 'admin' || user?.role === 'super_admin'
}

/** Returns true if currentUser is distributor role specifically */
export function isDistributor(user: AuthUser | null | undefined): boolean {
  return user?.role === 'distributor'
}

/**
 * Returns true if actor's role is strictly higher in the privilege hierarchy
 * than the given role. Useful for "at least X" checks.
 *
 * @example canAccessAtLeast(user, 'admin') → true for admin and super_admin, false for curator
 */
export function canAccessAtLeast(user: AuthUser | null | undefined, minRole: Role): boolean {
  if (!user?.role) return false
  return (ROLE_HIERARCHY[user.role as Role] ?? -1) >= (ROLE_HIERARCHY[minRole] ?? 99)
}

/** Returns true if currentUser is finance role specifically */
export function isFinance(user: AuthUser | null | undefined): boolean {
  return user?.role === 'finance'
}

/** Returns true if currentUser is curator role specifically */
export function isCurator(user: AuthUser | null | undefined): boolean {
  return user?.role === 'curator'
}

/**
 * Returns true only for the end-user role (the farmer/student/etc. public app).
 * Every other role (admin, super_admin, curator, finance, distributor) is
 * considered staff and uses the English-only UI — language switching is
 * reserved for end users.
 */
export function isEndUser(user: AuthUser | null | undefined): boolean {
  return user?.role === 'user'
}