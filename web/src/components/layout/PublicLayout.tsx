import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { VerificationBanner } from '@/components/VerificationBanner'
import { AnveshanMilestoneBanner } from '../AnveshanBanner'
import { PublicSidebar } from './PublicSidebar'
import { PublicHeader } from './PublicHeader'
import { PublicMobileNav } from './PublicMobileNav'
import { PublicBottomNav } from './PublicBottomNav'
import { useAuth } from '@/context/AuthContext'
import { questionApi } from '@/api/client'

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

  useEffect(() => {
    if (!user?.isAnveshanUser || !user.id) return
    const dismissedKey = `anveshan_milestone_banner_dismissed_${user.id}`
    if (localStorage.getItem(dismissedKey)) return

    questionApi.getMyAnveshanMilestone()
      .then((data) => {
        if (data.completed) setShowMilestoneBanner(true)
      })
      .catch(() => undefined)
  }, [user?.id, user?.isAnveshanUser])

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