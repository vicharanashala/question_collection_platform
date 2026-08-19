/**
 * Profile-completeness check for public users (role="user").
 *
 * Mirrors the backend's `verifyOtp` logic in
 * `backend/src/modules/auth/auth.service.ts`, where a user is considered
 * "registered" once they have a non-empty `name`. After registration the
 * wizard sets `name`, `category`, `consentGiven=true` and various
 * category-specific fields, so any of those being missing indicates the
 * user abandoned the wizard mid-flow and should be prompted to complete it
 * on their next visit.
 */
import type { AuthUser } from '@/types'

/**
 * Returns `true` when the public user has *not* finished the registration
 * wizard — either because they haven't registered at all yet (no `name`)
 * or because they abandoned mid-flow (missing `category`, etc.).
 *
 * Passing `null` / `undefined` returns `true` because we can't verify
 * completeness of a user we don't know about yet (e.g. right after OTP
 * verification but before `login()` populates the auth context).
 */
export function isProfileIncomplete(
  user: AuthUser | null | undefined,
): boolean {
  if (!user) return true
  if (!user.consentGiven) return true
  if (!user.name || !user.name.trim()) return true
  if (!user.category) return true
  return false
}