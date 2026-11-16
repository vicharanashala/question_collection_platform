import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion, MotionConfig } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { VerificationBanner } from '@/components/VerificationBanner'
import { TesterBanner } from '@/components/TesterBanner'
import { AnveshanAnswerTaskBanner, AnveshanProgressBanner } from '../AnveshanBanner'
import { AnveshanCompletionScreen } from '../AnveshanCompletionScreen'
import {
  AnveshanMilestoneModal,
  getAnveshanMilestonePercent,
  getAnveshanRemainingSubmissions,
} from '@/features/public/AnveshMileStone'
import { PublicSidebar } from './PublicSidebar'
import { PublicHeader } from './PublicHeader'
import { PublicMobileNav } from './PublicMobileNav'
import { PublicBottomNav } from './PublicBottomNav'
import { useAuth } from '@/stores/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import { questionKeys, useMyAnveshanMilestone } from '@/hooks/api/useQuestions'
import { anveshanProgressEmitter } from '@/events/anveshanProgressEvents'
import { ANVESHAN_ANSWERS_ROUTE } from '@/constants/public'
import { AnveshanFeedbackDialog } from '@/components/anveshan-answers/AnveshanFeedbackDialog'
import { deferFeedback, isFeedbackDeferred } from '@/components/anveshan-answers/feedbackPrompt'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { user } = useAuth()

  // Anveshan users wait for this first check so users who reached 100% never see the regular pages.
  // Bumped after each successful submission so progress reloads without a page refresh.
  const [progressVersion, setProgressVersion] = useState(0)
  const [answerTaskDismissed, setAnswerTaskDismissed] = useState(false)
  const [progressBannerDismissed, setProgressBannerDismissed] = useState(false)
  const [milestoneDetailsOpen, setMilestoneDetailsOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const onAnswersPage = location.pathname === ANVESHAN_ANSWERS_ROUTE

  useEffect(() => anveshanProgressEmitter.on(() => setProgressVersion((version) => version + 1)), [])

  // Milestone progress drives the banners and the completion lock. It is
  // refetched on each page change and after each submission (progressVersion),
  // so those stay current. A failed check shows the regular app rather than
  // locking the user out.
  const queryClient = useQueryClient()
  const isAnveshanUser = !!user?.isAnveshanUser && !!user.id
  const milestoneQuery = useMyAnveshanMilestone(isAnveshanUser)
  const milestone = milestoneQuery.data ?? null
  const milestoneChecked = milestoneQuery.isFetched

  const { refetch: refetchMilestone } = milestoneQuery
  useEffect(() => {
    if (isAnveshanUser) void refetchMilestone()
  }, [location.pathname, progressVersion, isAnveshanUser, refetchMilestone])

  // Ask for feedback once the milestone is complete, unless the user deferred it.
  useEffect(() => {
    if (!user?.id || !milestone) return
    if (milestone.completed && !milestone.feedbackSubmitted && !isFeedbackDeferred(user.id)) {
      setFeedbackOpen(true)
    }
  }, [milestone, user?.id])

  const showProgressBanner = !!milestone && !milestone.submissionsCompleted && !progressBannerDismissed && !onAnswersPage

  const showAnswerTaskBanner =
    !!milestone?.submissionsCompleted && !milestone.completed && !answerTaskDismissed && !onAnswersPage

  const feedbackDialog = (
    <AnveshanFeedbackDialog
      open={feedbackOpen}
      onOpenChange={(open) => {
        setFeedbackOpen(open)
        // Closing without sending means "maybe later": ask again next session, not on every page.
        if (!open && user?.id && !milestone?.feedbackSubmitted) deferFeedback(user.id)
      }}
      onSubmitted={() =>
        // Mark feedback as sent in the cache so the dialog does not reopen.
        queryClient.setQueryData(
          questionKeys.anveshanMilestone(),
          (prev: typeof milestone) => (prev ? { ...prev, feedbackSubmitted: true } : prev),
        )
      }
    />
  )

  if (user?.isAnveshanUser && !milestoneChecked) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">{t('leaderboard.loading')}</span>
      </div>
    )
  }

  // Anveshan users who reached 100% only see the completion screen; every other page is closed to them.
  if (user?.isAnveshanUser && milestone?.completed) {
    return (
      <MotionConfig reducedMotion="user">
        <AnveshanCompletionScreen milestone={milestone} userName={user.name} onShareFeedback={() => setFeedbackOpen(true)} />
        {feedbackDialog}
      </MotionConfig>
    )
  }

  return (
    // Framer Motion animations in the public app follow the user's reduced-motion setting.
    <MotionConfig reducedMotion="user">
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Desktop sidebar (hidden on mobile) */}
      <div className="hidden md:flex h-full shrink-0">
        <PublicSidebar />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <PublicHeader onOpenMobileNav={() => setMobileNavOpen(true)} />
        <VerificationBanner />
        <TesterBanner />
        <AnveshanProgressBanner
          visible={showProgressBanner}
          percent={milestone ? getAnveshanMilestonePercent(milestone) : 0}
          remaining={milestone ? getAnveshanRemainingSubmissions(milestone) : []}
          onViewDetails={() => setMilestoneDetailsOpen(true)}
          onDismiss={() => setProgressBannerDismissed(true)}
        />
        <AnveshanAnswerTaskBanner
          visible={showAnswerTaskBanner}
          answered={milestone?.progress.answers ?? 0}
          required={milestone?.requirements.answers ?? 0}
          onStart={() => navigate(ANVESHAN_ANSWERS_ROUTE)}
          onDismiss={() => setAnswerTaskDismissed(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 md:pb-6">
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

      <AnveshanMilestoneModal open={milestoneDetailsOpen} onOpenChange={setMilestoneDetailsOpen} data={milestone} />

      {feedbackDialog}

      {/* Mobile bottom tab bar (hidden on desktop) */}
      <PublicBottomNav />

      {/* Mobile drawer (hamburger menu) */}
      <PublicMobileNav
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
    </div>
    </MotionConfig>
  )
}