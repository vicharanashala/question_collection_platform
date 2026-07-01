/**
 * DashboardRouter — renders the correct dashboard component by role.
 * Accessed via the shared /dashboard route.
 * SuperAdmin shares AdminDashboardPage (content is identical at this stage;
 * navigation difference is handled in Sidebar.tsx Phase 5).
 */
import { useAuth } from '@/context/AuthContext'
import { isCurator, isFinance } from '@/lib/roles'
import { AdminDashboardPage } from './AdminDashboardPage'
import { CuratorDashboardPage } from './CuratorDashboardPage'
import { FinanceDashboardPage } from './FinanceDashboardPage'

export function DashboardRouter() {
  const { user } = useAuth()

  if (isCurator(user)) return <CuratorDashboardPage />
  if (isFinance(user)) return <FinanceDashboardPage />
  // admin and super_admin share AdminDashboardPage
  return <AdminDashboardPage />
}