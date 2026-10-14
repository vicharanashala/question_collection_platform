import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { FlaskConical, Sprout } from 'lucide-react'
import { useAnveshanScope } from '@/lib/anveshanMode'
import { useTesterScope } from '@/lib/testerMode'
import { VerificationBanner } from '@/components/VerificationBanner'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'
import { StaffBottomNav } from './StaffBottomNav'

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const anveshanScope = useAnveshanScope()
  const testerScope = useTesterScope()
  const [glaze, setGlaze] = useState<{ id: number; tester: boolean } | null>(null)
  const isFirstRender = useRef(true)

  const previousAnveshan = useRef(anveshanScope)

  // Plays the glaze sweep each time a mode is toggled, but not on the first load.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const anveshanChanged = previousAnveshan.current !== anveshanScope
    previousAnveshan.current = anveshanScope
    const turnedOn = (anveshanChanged ? anveshanScope : testerScope) !== 'all'
    // Going back to "all" plays no sweep.
    if (!turnedOn) {
      setGlaze(null)
      return
    }
    setGlaze((previous) => ({ id: (previous?.id ?? 0) + 1, tester: !anveshanChanged }))
    const timer = window.setTimeout(() => setGlaze(null), 1100)
    return () => window.clearTimeout(timer)
  }, [anveshanScope, testerScope])

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
        <AnimatePresence initial={false}>
          {anveshanScope !== 'all' && (
            <motion.div
              key="anveshan-mode-banner"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 sm:px-6">
                <Sprout className="h-4 w-4 shrink-0" aria-hidden="true" />
                {anveshanScope === 'only' ? 'Showing data from Anveshan users only.' : 'Showing data from non-Anveshan users only.'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {testerScope !== 'all' && (
            <motion.div
              key="tester-mode-banner"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 sm:px-6">
                <FlaskConical className="h-4 w-4 shrink-0" aria-hidden="true" />
                {testerScope === 'only' ? 'Showing data from tester accounts only.' : 'Showing data from non-tester accounts only.'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/*
          Extra bottom padding (`pb-20`) on small screens so page content
          isn't hidden under the fixed bottom tab bar. Reverts to default
          `pb-6` (Tailwind's `p-6`) on `md` where the bottom bar is hidden.
        */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 md:pb-6">
          {/* Keyed by path and the staff modes: pages fade in on navigation and reload their data when the mode changes. Query-only changes (tabs) do not replay it. */}
          <motion.div
            key={`${location.pathname}:${anveshanScope}:${testerScope}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Glaze sweep shown briefly when Anveshan mode is toggled */}
      <AnimatePresence>
        {glaze && (
          <motion.div
            key={glaze.id}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[70] overflow-hidden"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background: glaze.tester
                  ? 'radial-gradient(circle at 50% 0%, rgba(245,158,11,0.35), transparent 60%)'
                  : 'radial-gradient(circle at 50% 0%, rgba(16,185,129,0.35), transparent 60%)',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -inset-y-10 w-1/3 -skew-x-12"
              style={{
                background: glaze.tester
                  ? 'linear-gradient(90deg, transparent, rgba(252,211,77,0.35), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(110,231,183,0.35), transparent)',
              }}
              initial={{ left: '-40%' }}
              animate={{ left: '120%' }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

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