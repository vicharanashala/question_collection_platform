import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PublicSidebar } from './PublicSidebar'
import { PublicHeader } from './PublicHeader'
import { PublicMobileNav } from './PublicMobileNav'
import { PublicBottomNav } from './PublicBottomNav'

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-emerald-50/60 via-background to-background dark:from-emerald-950/30">
      {/* Desktop sidebar (hidden on mobile) */}
      <div className="hidden md:flex h-full shrink-0">
        <PublicSidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <PublicHeader onMobileMenuToggle={() => setMobileNavOpen(true)} />
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
