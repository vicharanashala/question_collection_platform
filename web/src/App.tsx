import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { PrefetchProvider } from '@/context/PrefetchContext'
import { lazyRoute } from '@/components/LazyRoute'
import type { UserRole } from '@/types'

const LoginPage      = lazyRoute(() => import('@/pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardPage  = lazyRoute(() => import('@/pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const UsersPage      = lazyRoute(() => import('@/pages/users/UsersPage').then(m => ({ default: m.UsersPage })))
const UserDetailPage = lazyRoute(() => import('@/pages/users/UserDetailPage').then(m => ({ default: m.UserDetailPage })))
const QuestionsPage  = lazyRoute(() => import('@/pages/questions/QuestionsPage').then(m => ({ default: m.QuestionsPage })))
const ReviewsPage    = lazyRoute(() => import('@/pages/reviews/ReviewsPage').then(m => ({ default: m.ReviewsPage })))
const ProfilePage    = lazyRoute(() => import('@/pages/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const SettingsPage   = lazyRoute(() => import('@/pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const WithdrawalsPage = lazyRoute(() => import('@/pages/withdrawals/WithdrawalsPage').then(m => ({ default: m.WithdrawalsPage })))
const WalletsPage       = lazyRoute(() => import('@/pages/wallets/WalletsPage').then(m => ({ default: m.WalletsPage })))
const AuditLogsPage     = lazyRoute(() => import('@/pages/audit-logs/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })))

/** Pages visible per role */
const PAGE_ROLES: Record<string, UserRole[]> = {
  dashboard:    ['user', 'curator', 'finance', 'admin', 'super_admin'],
  users:        ['finance', 'admin', 'super_admin'],
  userDetail:   ['admin', 'super_admin', 'finance'],
  questions:    ['user', 'curator', 'admin', 'super_admin'],
  reviews:      ['curator', 'super_admin'],
  profile:      ['user', 'curator', 'finance', 'admin', 'super_admin'],
  settings:     ['super_admin'],
  withdrawals:   ['finance', 'admin', 'super_admin'],
  wallets:       ['finance', 'admin', 'super_admin'],
auditLogs:     ['super_admin', 'admin'],
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
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
 * Outer shell — provides PrefetchContext to all routes.
 * All route components are code-split via React.lazy above.
 */
export default function App() {
  return (
    <PrefetchProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<><RoleRoute pageKey="dashboard" /><DashboardPage /></>} />
          <Route path="users"      element={<><RoleRoute pageKey="users" /><UsersPage /></>} />
          <Route path="users/:userId" element={<><RoleRoute pageKey="userDetail" /><UserDetailPage /></>} />
          <Route path="questions"  element={<><RoleRoute pageKey="questions" /><QuestionsPage /></>} />
          <Route path="reviews"    element={<><RoleRoute pageKey="reviews" /><ReviewsPage /></>} />
          <Route path="profile"    element={<><RoleRoute pageKey="profile" /><ProfilePage /></>} />
          <Route path="settings"   element={<><RoleRoute pageKey="settings" /><SettingsPage /></>} />
          <Route path="withdrawals" element={<><RoleRoute pageKey="withdrawals" /><WithdrawalsPage /></>} />
          <Route path="wallets"        element={<><RoleRoute pageKey="wallets"      /><WalletsPage    /></>} />
<Route path="audit-logs"     element={<><RoleRoute pageKey="auditLogs" /><AuditLogsPage /></>} />
        </Route>
      </Routes>
    </PrefetchProvider>
  )
}