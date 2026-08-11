import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PublicSidebar } from './PublicSidebar'
import { PublicHeader } from './PublicHeader'
import { PublicMobileNav } from './PublicMobileNav'

/**
 * Shell for the public-user app (role="user"). Visually distinct from the
 * staff `AppLayout` so users can never accidentally see admin pages.
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      <PublicMobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </div>
  )
}
