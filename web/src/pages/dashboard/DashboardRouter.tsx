import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { isCurator, isFinance, isDistributor } from '@/lib/roles'
import { AdminDashboardPage } from './AdminDashboardPage'
import { CuratorDashboardPage } from './CuratorDashboardPage'
import { FinanceDashboardPage } from './FinanceDashboardPage'
import { DistributorDashboardPage } from './DistributorDashboardPage'

export function DashboardRouter() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.role === 'user') navigate('/public', { replace: true })
  }, [user, navigate])

  if (user?.role === 'user') return null
  if (isCurator(user)) return <CuratorDashboardPage />
  if (isFinance(user)) return <FinanceDashboardPage />
  if (isDistributor(user)) return <DistributorDashboardPage />
  return <AdminDashboardPage />
}