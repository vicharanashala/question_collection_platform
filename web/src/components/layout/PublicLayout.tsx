import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { VerificationBanner } from '@/components/VerificationBanner'
import { AnveshanAnswerTaskBanner, AnveshanMilestoneBanner } from '../AnveshanBanner'
import { PublicSidebar } from './PublicSidebar'
import { PublicHeader } from './PublicHeader'
import { PublicMobileNav } from './PublicMobileNav'
import { PublicBottomNav } from './PublicBottomNav'
import { useAuth } from '@/context/AuthContext'
import { questionApi, type AnveshanMilestoneResponse } from '@/api/client'
import { ANVESHAN_ANSWERS_ROUTE } from '@/constants/public'

/**
 * Shell for the public-user app (role="user"). Visually distinct from the
 * staff `AppLayout` so users can never accidentally see admin pages.
 *
 * Navigation chrome:
 *  - Desktop (`md:`): left sidebar with full nav links + user/logout block.
 *  - Mobile: bottom tab bar mirroring the mobile app, plus a hamburger
 *    drawer in the header for secondary actions.
 */
export function PublicLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { user } = useAuth()
  const [showMilestoneBanner, setShowMilestoneBanner] = useState(false)
  const [milestone, setMilestone] = useState<AnveshanMilestoneResponse | null>(null)
  const [answerTaskDismissed, setAnswerTaskDismissed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const onAnswersPage = location.pathname === ANVESHAN_ANSWERS_ROUTE

  // Loads milestone progress on mount and when leaving the answers page, so the banners reflect new answers.
  useEffect(() => {
    if (!user?.isAnveshanUser || !user.id || onAnswersPage) return
    const dismissedKey = `anveshan_milestone_banner_dismissed_${user.id}`

    questionApi.getMyAnveshanMilestone()
      .then((data) => {
        setMilestone(data)
        if (data.completed && !localStorage.getItem(dismissedKey)) setShowMilestoneBanner(true)
      })
      .catch(() => undefined)
  }, [user?.id, user?.isAnveshanUser, onAnswersPage])

  const showAnswerTaskBanner =
    !!milestone?.submissionsCompleted && !milestone.completed && !answerTaskDismissed && !onAnswersPage

  function dismissMilestoneBanner() {
    if (user?.id) {
      localStorage.setItem(`anveshan_milestone_banner_dismissed_${user.id}`, '1')
    }
    setShowMilestoneBanner(false)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Desktop sidebar (hidden on mobile) */}
      <div className="hidden md:flex h-full shrink-0">
        <PublicSidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <PublicHeader onOpenMobileNav={() => setMobileNavOpen(true)} />
        <VerificationBanner />
        <AnveshanMilestoneBanner visible={showMilestoneBanner} onDismiss={dismissMilestoneBanner} />
        <AnveshanAnswerTaskBanner
          visible={showAnswerTaskBanner}
          answered={milestone?.progress.answers ?? 0}
          required={milestone?.requirements.answers ?? 0}
          onStart={() => navigate(ANVESHAN_ANSWERS_ROUTE)}
          onDismiss={() => setAnswerTaskDismissed(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar (hidden on desktop) */}
      <PublicBottomNav />

      {/* Mobile drawer (hamburger menu) */}
      <PublicMobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </div>
  )
}