import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, MotionConfig } from 'framer-motion'
import { VerificationBanner } from '@/components/VerificationBanner'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { StaffBottomNav } from './StaffBottomNav'

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()

  const openMobileNav = () => setMobileNavOpen(true)

  return (
    // Animations follow the user's reduced-motion setting.
    <MotionConfig reducedMotion="user">
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Desktop sidebar (hidden on mobile) */}
      <div className="hidden md:flex h-full shrink-0">
        <Sidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenMobileNav={openMobileNav} />
        <VerificationBanner />
        {/*
          Extra bottom padding (`pb-20`) on small screens so page content
          isn't hidden under the fixed bottom tab bar. Reverts to default
          `pb-6` (Tailwind's `p-6`) on `md` where the bottom bar is hidden.
        */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 md:pb-6">
          {/* Keyed by path so each page fades and rises in on navigation; query-only changes (tabs) do not replay it. */}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Mobile bottom tab bar — quick-access destinations on small screens */}
      <StaffBottomNav onOpenMenu={openMobileNav} />

      {/* Mobile drawer (full nav + admin-only routes) */}
      <MobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </div>
    </MotionConfig>
  )
}