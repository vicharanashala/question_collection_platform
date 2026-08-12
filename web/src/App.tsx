import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { PrefetchProvider } from '@/context/PrefetchContext'
import { lazyRoute } from '@/components/LazyRoute'
import { LockedAccountModal } from '@/components/LockedAccountModal'
import type { UserRole } from '@/types'

// ── Staff / admin pages (existing) ─────────────────────────────────────────
const LoginPage       = lazyRoute(() => import('@/pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardRouter = lazyRoute(() => import('@/pages/dashboard/DashboardRouter').then(m => ({ default: m.DashboardRouter })))
const UsersPage       = lazyRoute(() => import('@/pages/users/UsersPage').then(m => ({ default: m.UsersPage })))
const UserDetailPage  = lazyRoute(() => import('@/pages/users/UserDetailPage').then(m => ({ default: m.UserDetailPage })))
const QuestionsPage   = lazyRoute(() => import('@/pages/questions/QuestionsPage').then(m => ({ default: m.QuestionsPage })))
const ReviewsPage     = lazyRoute(() => import('@/pages/reviews/ReviewsPage').then(m => ({ default: m.ReviewsPage })))
const ProfilePage     = lazyRoute(() => import('@/pages/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const SettingsPage    = lazyRoute(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const WithdrawalsPage = lazyRoute(() => import('@/pages/withdrawals/WithdrawalsPage').then(m => ({ default: m.WithdrawalsPage })))
const WalletsPage     = lazyRoute(() => import('@/pages/wallets/WalletsPage').then(m => ({ default: m.WalletsPage })))
const AuditLogsPage   = lazyRoute(() => import('@/pages/audit-logs/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })))
const ReportsPage     = lazyRoute(() => import('@/pages/reports/ReportsPage').then(m => ({ default: m.default })))
const ReportDetailPage = lazyRoute(() => import('@/pages/reports/ReportDetailPage').then(m => ({ default: m.default })))
const FaqListPage   = lazyRoute(() => import('@/pages/faqs/FaqListPage').then(m => ({ default: m.FaqListPage })))
const FaqsPage      = lazyRoute(() => import('@/pages/faqs/FaqsPage').then(m => ({ default: m.FaqsPage })))
const DistributionsPage = lazyRoute(() => import('@/pages/distributions/DistributionsPage').then(m => ({ default: m.DistributionsPage })))

// ── Public-user pages (role="user") ────────────────────────────────────────
const PublicRegisterPage             = lazyRoute(() => import('@/pages/auth/PublicRegisterPage').then(m => ({ default: m.PublicRegisterPage })))
const PublicVerificationPendingPage  = lazyRoute(() => import('@/pages/public/PublicVerificationPendingPage').then(m => ({ default: m.PublicVerificationPendingPage })))
const PublicHomePage                 = lazyRoute(() => import('@/pages/public/PublicHomePage').then(m => ({ default: m.PublicHomePage })))
const PublicAskPage                  = lazyRoute(() => import('@/pages/public/PublicAskPage').then(m => ({ default: m.PublicAskPage })))
const PublicQuestionsPage            = lazyRoute(() => import('@/pages/public/PublicQuestionsPage').then(m => ({ default: m.PublicQuestionsPage })))
const PublicFaqsPage                 = lazyRoute(() => import('@/pages/public/PublicFaqsPage').then(m => ({ default: m.PublicFaqsPage })))
const PublicProfilePage              = lazyRoute(() => import('@/pages/public/PublicProfilePage').then(m => ({ default: m.PublicProfilePage })))
const PublicWalletPage               = lazyRoute(() => import('@/pages/public/PublicWalletPage').then(m => ({ default: m.PublicWalletPage })))
const PublicReportsPage              = lazyRoute(() => import('@/pages/public/PublicReportsPage').then(m => ({ default: m.default })))
const PublicReportDetailPage         = lazyRoute(() => import('@/pages/public/PublicReportDetailPage').then(m => ({ default: m.default })))
const PublicPaymentMethodsPage       = lazyRoute(() => import('@/pages/public/PublicPaymentMethodsPage').then(m => ({ default: m.PublicPaymentMethodsPage })))
const PublicTermsPage                = lazyRoute(() => import('@/pages/public/PublicTermsPage').then(m => ({ default: m.default })))
const PublicPrivacyPage              = lazyRoute(() => import('@/pages/public/PublicPrivacyPage').then(m => ({ default: m.default })))
const PublicNotificationsPage        = lazyRoute(() => import('@/pages/public/PublicNotificationsPage').then(m => ({ default: m.default })))
const PublicLeaderboardPage          = lazyRoute(() => import('@/pages/public/PublicLeaderboardPage').then(m => ({ default: m.default })))

/** Pages visible per role (staff / admin side) */
const PAGE_ROLES: Record<string, UserRole[]> = {
  dashboard:   ['admin', 'super_admin', 'curator', 'finance', 'distributor'],
  users:       ['finance', 'admin', 'super_admin'],
  userDetail:  ['admin', 'super_admin', 'finance'],
  questions:   ['curator', 'admin', 'super_admin'],
  reviews:     ['curator', 'super_admin'],
  profile:     ['user', 'curator', 'finance', 'distributor', 'admin', 'super_admin'],
  settings:    ['super_admin'],
  withdrawals: ['finance', 'admin', 'super_admin'],
  wallets:     ['finance', 'admin', 'super_admin'],
  auditLogs:   ['super_admin', 'admin'],
  reports:     ['admin', 'super_admin', 'curator'],
  reportDetail: ['admin', 'super_admin', 'curator'],
  faqs:        ['user', 'curator', 'admin', 'super_admin', 'finance'],
  faqAdmin:    ['admin', 'super_admin'],
  distributions: ['distributor', 'admin', 'super_admin'],
}

/** If unauthenticated, send to /login. */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

/**
 * Blocks role="user" from entering the staff shell. Public users
 * (`role="user"`) get redirected to their own app at `/public`.
 */
function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user?.role === 'user') return <Navigate to="/public" replace />
  return <>{children}</>
}

/**
 * Public-side guard: must be authenticated AND must be role="user". Staff
 * (admin/super_admin/curator/etc.) get bounced to the staff dashboard.
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role && user.role !== 'user') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/** Redirects to the first accessible page if current role has no access to the page */
function RoleRoute({ pageKey }: { pageKey: string }) {
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
function HomeRedirect() {
  const { user } = useAuth()
  if (user?.role === 'user') return <Navigate to="/public" replace />
  return <Navigate to="/dashboard" replace />
}

/**
 * Outer shell — provides PrefetchContext to all routes.
 * All route components are code-split via React.lazy above.
 */
export default function App() {
  return (
    <PrefetchProvider>
      {/* Locked account modal rendered outside the protected layout so it
          survives navigation to /login after a 423 lock response. */}
      <LockedAccountModal />

      <Routes>
        {/* ── Public auth pages (no auth required) ──────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/public/register" element={<PublicRegisterPage />} />
        <Route path="/public/verification-pending" element={<PublicVerificationPendingPage />} />

        {/* ── Staff shell (admin/super_admin/curator/finance/distributor) ── */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <StaffRoute>
                <AppLayout />
              </StaffRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard"   element={<><RoleRoute pageKey="dashboard" /><DashboardRouter /></>} />
          <Route path="users"      element={<><RoleRoute pageKey="users" /><UsersPage /></>} />
          <Route path="users/:userId" element={<><RoleRoute pageKey="userDetail" /><UserDetailPage /></>} />
          <Route path="questions"  element={<><RoleRoute pageKey="questions" /><QuestionsPage /></>} />
          <Route path="reviews"    element={<><RoleRoute pageKey="reviews" /><ReviewsPage /></>} />
          <Route path="profile"    element={<><RoleRoute pageKey="profile" /><ProfilePage /></>} />
          <Route path="settings"   element={<><RoleRoute pageKey="settings" /><SettingsPage /></>} />
          <Route path="withdrawals" element={<><RoleRoute pageKey="withdrawals" /><WithdrawalsPage /></>} />
          <Route path="wallets"        element={<><RoleRoute pageKey="wallets"      /><WalletsPage    /></>} />
          <Route path="audit-logs" element={<><RoleRoute pageKey="auditLogs" /><AuditLogsPage /></>} />
          <Route path="reports"    element={<><RoleRoute pageKey="reports" /><ReportsPage /></>} />
          <Route path="reports/:reportId" element={<><RoleRoute pageKey="reportDetail" /><ReportDetailPage /></>} />
          <Route path="faqs"           element={<><RoleRoute pageKey="faqs"     /><FaqListPage  /></>} />
          <Route path="admin/faqs"     element={<><RoleRoute pageKey="faqAdmin" /><FaqsPage     /></>} />
          <Route path="distributions"  element={<><RoleRoute pageKey="distributions" /><DistributionsPage /></>} />
        </Route>

        {/* ── Public user shell (role="user" only) ───────────────────────── */}
        <Route
          path="/public"
          element={
            <PublicRoute>
              <PublicLayout />
            </PublicRoute>
          }
        >
          <Route index               element={<PublicHomePage />} />
          <Route path="ask"          element={<PublicAskPage />} />
          <Route path="questions"    element={<PublicQuestionsPage />} />
          <Route path="faqs"         element={<PublicFaqsPage />} />
          <Route path="profile"      element={<PublicProfilePage />} />
          <Route path="wallet"             element={<PublicWalletPage />} />
          <Route path="reports"             element={<PublicReportsPage />} />
          <Route path="reports/:reportId"   element={<PublicReportDetailPage />} />
          <Route path="payment-methods"    element={<PublicPaymentMethodsPage />} />
          <Route path="terms"              element={<PublicTermsPage />} />
          <Route path="privacy"            element={<PublicPrivacyPage />} />
          <Route path="notifications"      element={<PublicNotificationsPage />} />
          <Route path="leaderboard"        element={<PublicLeaderboardPage />} />
        </Route>

        {/* ── Fallback ────────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PrefetchProvider>
  )
}