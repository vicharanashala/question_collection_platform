import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { lazyRoute } from '@/components/LazyRoute'
import {
  ProtectedRoute,
  StaffRoute,
  RootGate,
  PublicRoute,
  AnveshanRoute,
  PaymentRoute,
  RoleRoute,
  HomeRedirect,
} from './guards'

// ── Staff / admin pages (existing) ─────────────────────────────────────────
const LoginPage       = lazyRoute(() => import('@/features/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardRouter = lazyRoute(() => import('@/features/dashboard/DashboardRouter').then(m => ({ default: m.DashboardRouter })))
const UsersPage       = lazyRoute(() => import('@/features/users/UsersPage').then(m => ({ default: m.UsersPage })))
const AnveshanUserDetailPage = lazyRoute(() => import('@/features/users/AnveshanUserDetailPage').then(m => ({ default: m.AnveshanUserDetailPage })))
const UserDetailPage  = lazyRoute(() => import('@/features/users/UserDetailPage').then(m => ({ default: m.UserDetailPage })))
const QuestionsPage   = lazyRoute(() => import('@/features/questions/QuestionsPage').then(m => ({ default: m.QuestionsPage })))
const ReviewsPage     = lazyRoute(() => import('@/features/reviews/ReviewsPage').then(m => ({ default: m.ReviewsPage })))
const ProfilePage     = lazyRoute(() => import('@/features/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))
const SettingsPage    = lazyRoute(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })))
const WithdrawalsPage = lazyRoute(() => import('@/features/withdrawals/WithdrawalsPage').then(m => ({ default: m.WithdrawalsPage })))
const WalletsPage     = lazyRoute(() => import('@/features/wallets/WalletsPage').then(m => ({ default: m.WalletsPage })))
const AuditLogsPage   = lazyRoute(() => import('@/features/audit-logs/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })))
const ReportsPage     = lazyRoute(() => import('@/features/reports/ReportsPage').then(m => ({ default: m.default })))
const ReportDetailPage = lazyRoute(() => import('@/features/reports/ReportDetailPage').then(m => ({ default: m.default })))
const FaqListPage   = lazyRoute(() => import('@/features/faqs/FaqListPage').then(m => ({ default: m.FaqListPage })))
const FaqsPage      = lazyRoute(() => import('@/features/faqs/FaqsPage').then(m => ({ default: m.FaqsPage })))
const DistributionsPage = lazyRoute(() => import('@/features/distributions/DistributionsPage').then(m => ({ default: m.DistributionsPage })))
const FeedbacksPage = lazyRoute(() => import('@/features/feedbacks/FeedbacksPage').then(m => ({ default: m.FeedbacksPage })))
const AgriEntitiesPage = lazyRoute(() => import('@/features/agri-entities/AgriEntitiesPage').then(m => ({ default: m.AgriEntitiesPage })))

// ── Public-user pages (role="user") ────────────────────────────────────────

const PublicVerificationPendingPage  = lazyRoute(() => import('@/features/public/PublicVerificationPendingPage').then(m => ({ default: m.PublicVerificationPendingPage })))
const PublicHomePage                 = lazyRoute(() => import('@/features/public/PublicHomePage').then(m => ({ default: m.PublicHomePage })))
const PublicAskPage                  = lazyRoute(() => import('@/features/public/PublicAskPage').then(m => ({ default: m.PublicAskPage })))
const PublicQuestionsPage            = lazyRoute(() => import('@/features/public/PublicQuestionsPage').then(m => ({ default: m.PublicQuestionsPage })))
const PublicFaqsPage                 = lazyRoute(() => import('@/features/public/PublicFaqsPage').then(m => ({ default: m.PublicFaqsPage })))
const PublicProfilePage              = lazyRoute(() => import('@/features/public/PublicProfilePage').then(m => ({ default: m.PublicProfilePage })))
const PublicWalletPage               = lazyRoute(() => import('@/features/public/PublicWalletPage').then(m => ({ default: m.PublicWalletPage })))
const PublicReportsPage              = lazyRoute(() => import('@/features/public/PublicReportsPage').then(m => ({ default: m.default })))
const PublicReportDetailPage         = lazyRoute(() => import('@/features/public/PublicReportDetailPage').then(m => ({ default: m.default })))
const PublicPaymentMethodsPage       = lazyRoute(() => import('@/features/public/PublicPaymentMethodsPage').then(m => ({ default: m.PublicPaymentMethodsPage })))
const PublicTermsPage                = lazyRoute(() => import('@/features/public/PublicTermsPage').then(m => ({ default: m.default })))
const PublicPrivacyPage              = lazyRoute(() => import('@/features/public/PublicPrivacyPage').then(m => ({ default: m.default })))
const PublicNotificationsPage        = lazyRoute(() => import('@/features/public/PublicNotificationsPage').then(m => ({ default: m.default })))
const PublicLeaderboardPage          = lazyRoute(() => import('@/features/public/PublicLeaderboardPage').then(m => ({ default: m.default })))

const AnveshanAnswersPage            = lazyRoute(() => import('@/features/public/AnveshanAnswersPage').then(m => ({ default: m.AnveshanAnswersPage })))
const AnveshanPhaseGatePage              = lazyRoute(()=>import('@/features/public/AnveshanPhaseGate').then(m => ({ default: m.AnveshanPhaseGatePage })))

/** Full route tree: URL to page. All route components are code-split via lazyRoute. */
export function AppRoutes() {
  return (
  <Routes>
    {/* ── Public auth pages (no auth required) ──────────────────────── */}
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<Navigate to="/login" replace />} />
    <Route path="/home/verification-pending" element={<PublicVerificationPendingPage />} />
    <Route path="/home/anveshan-phase-gate" element={<AnveshanPhaseGatePage />} />

    {/* ── Root gate: home page for visitors, staff shell for staff ──── */}
    <Route
      path="/"
      element={
        <RootGate>
          <ProtectedRoute>
            <StaffRoute>
              <AppLayout />
            </StaffRoute>
          </ProtectedRoute>
       </RootGate>
      }
    >
      <Route index element={<HomeRedirect />} />
      <Route path="dashboard"   element={<><RoleRoute pageKey="dashboard" /><DashboardRouter /></>} />
      <Route path="users"      element={<><RoleRoute pageKey="users" /><UsersPage /></>} />
      <Route path="users/:userId" element={<><RoleRoute pageKey="userDetail" /><UserDetailPage /></>} />
      <Route path="users/:userId/anveshan" element={<><RoleRoute pageKey="userDetail" /><AnveshanUserDetailPage /></>} />
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
      <Route path="agri-entities"  element={<><RoleRoute pageKey="agriEntities" /><AgriEntitiesPage /></>} />
      <Route path="feedbacks"      element={<><RoleRoute pageKey="feedbacks" /><FeedbacksPage /></>} />
    </Route>

    {/* ── Public user shell (role="user" only) ───────────────────────── */}
    <Route
      path="/home"
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
      <Route path="wallet"             element={<PaymentRoute><PublicWalletPage /></PaymentRoute>} />
      <Route path="reports"             element={<PublicReportsPage />} />
      <Route path="reports/:reportId"   element={<PublicReportDetailPage />} />
      <Route path="payment-methods"    element={<PaymentRoute><PublicPaymentMethodsPage /></PaymentRoute>} />
      <Route path="terms"              element={<PublicTermsPage />} />
      <Route path="privacy"            element={<PublicPrivacyPage />} />
      <Route path="notifications"      element={<PublicNotificationsPage />} />
      <Route path="leaderboard"        element={<PublicLeaderboardPage />} />
      <Route path="anveshan-answers"   element={<AnveshanRoute><AnveshanAnswersPage /></AnveshanRoute>} />
    </Route>

    {/* ── Fallback ────────────────────────────────────────────────────── */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
  )
}
