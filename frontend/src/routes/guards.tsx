import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/stores/AuthContext'
import type { UserRole } from '@/types'
import { canAccessPayments } from '@/utils/paymentAccess'

/** Pages visible per role (staff / admin side) */
export const PAGE_ROLES: Record<string, UserRole[]> = {
  dashboard:   ['admin', 'super_admin', 'curator', 'finance', 'distributor'],
  users:       ['finance', 'admin', 'super_admin'],
  userDetail:  ['admin', 'super_admin', 'finance'],
  questions:   ['curator', 'admin', 'super_admin'],
  reviews:     ['curator', 'super_admin'],
  profile:     ['user', 'curator', 'finance', 'distributor', 'admin', 'super_admin'],
  settings:    ['super_admin'],
  withdrawals: ['finance', 'admin', 'super_admin'],
  wallets:     ['finance', 'admin', 'super_admin'],
  auditLogs:   ['super_admin', 'admin', 'finance', 'curator', 'distributor'],
  reports:     ['admin', 'super_admin', 'curator'],
  reportDetail: ['admin', 'super_admin', 'curator'],
  faqs:        ['user', 'curator', 'admin', 'super_admin', 'finance'],
  faqAdmin:    ['admin', 'super_admin'],
  distributions: ['distributor', 'admin', 'super_admin'],
  agriEntities: ['curator', 'admin', 'super_admin'],
  feedbacks:   ['admin', 'super_admin'],
}

/** If unauthenticated, send to /login. */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/**
 * Blocks role="user" from entering the staff shell. Public users
 * (`role="user"`) get redirected to their own app at `/public`.
 */
export function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role === 'user') return <Navigate to="/home" replace />
  return <>{children}</>
}

/**
 * Root route gate: serves the public registration/wizard as the home
 * page for unauthenticated visitors, sends authenticated role="user"
 * accounts to their `/public` app, and falls through to the existing
 * staff shell for staff users. Wraps the `/` route's element.
 */
export function RootGate({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) {
    // Visitors at "/" without auth get routed to /register where the
    // mobile + OTP gate lives.
    return <Navigate to="/register" replace />
  }
  if (user?.role === 'user') return <Navigate to="/home" replace />
  return <>{children}</>
}

/**
 * Public-side guard: must be authenticated AND must be role="user". Staff
 * (admin/super_admin/curator/etc.) get bounced to the staff dashboard, and
 * accounts still awaiting admin verification are held on the pending screen.
 */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()
  const state = location.state as { mobileNumber?: string } | null
  // Allow visitors who just verified their OTP (state.mobileNumber is set)
  // through without full auth so they can complete the profile on /home via
  // the modal. Without this carve-out they would be bounced to /login and
  // would lose the post-OTP flow.
  const postOtpNeedingProfile = !!state?.mobileNumber && !isAuthenticated
  if (isLoading) return null
  if (!isAuthenticated && !postOtpNeedingProfile) return <Navigate to="/login" replace />
  if (user?.role && user.role !== 'user') return <Navigate to="/dashboard" replace />
  // Accounts an admin has not approved yet stay on the pending screen. The backend
  // rejects their submissions, so the rest of the public app would only dead-end.
  if (user?.verificationStatus && user.verificationStatus !== 'verified') {
    return <Navigate to="/home/verification-pending" replace />
  }
  return <>{children}</>
}

// Only Anveshan users can open the answer page; everyone else goes back to home.
export function AnveshanRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user?.isAnveshanUser) return <Navigate to="/home" replace />
  return <>{children}</>
}

// Sends Anveshan users back to home when they open a wallet or payment page directly.
export function PaymentRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!canAccessPayments(user)) return <Navigate to="/home" replace />
  return <>{children}</>
}

/** Redirects to the first accessible page if current role has no access to the page */
export function RoleRoute({ pageKey }: { pageKey: string }) {
  const { user } = useAuth()
  const allowedRoles = PAGE_ROLES[pageKey] ?? []
  if (!allowedRoles.includes(user?.role as UserRole)) {
    // Find the first page this role can access
    const redirectPage = Object.entries(PAGE_ROLES).find(([, roles]) =>
      roles.includes(user?.role as UserRole)
    )?.[0]
    return <Navigate to={`/${redirectPage}`} replace />
  }
  return null
}

/**
 * Decide where to send a freshly-authenticated user based on their role.
 * Public users → /public. Staff users → /dashboard.
 */
export function HomeRedirect() {
  const { user } = useAuth()
  if (user?.role === 'user') return <Navigate to="/home" replace />
  return <Navigate to="/dashboard" replace />
}
