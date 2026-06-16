import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from '@/context/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { PrefetchProvider } from '@/context/PrefetchContext'
import { lazyRoute } from '@/components/LazyRoute'
import { SkeletonPage } from '@/components/ui/skeleton'

const LoginPage     = lazyRoute(() => import('@/pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardPage = lazyRoute(() => import('@/pages/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const UsersPage     = lazyRoute(() => import('@/pages/users/UsersPage').then(m => ({ default: m.UsersPage })))
const UserDetailPage = lazyRoute(() => import('@/pages/users/UserDetailPage').then(m => ({ default: m.UserDetailPage })))
const QuestionsPage = lazyRoute(() => import('@/pages/questions/QuestionsPage').then(m => ({ default: m.QuestionsPage })))
const ReviewsPage   = lazyRoute(() => import('@/pages/reviews/ReviewsPage').then(m => ({ default: m.ReviewsPage })))
const ProfilePage   = lazyRoute(() => import('@/pages/profile/ProfilePage').then(m => ({ default: m.ProfilePage })))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
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
          <Route path="dashboard"  element={<DashboardPage />} />
          <Route path="users"      element={<UsersPage />} />
          <Route path="users/:userId" element={<UserDetailPage />} />
          <Route path="questions"  element={<QuestionsPage />} />
          <Route path="reviews"    element={<ReviewsPage />} />
          <Route path="profile"    element={<ProfilePage />} />
        </Route>
      </Routes>
    </PrefetchProvider>
  )
}