import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, MotionConfig } from 'framer-motion'
import { CheckCircle2, MessageCircleQuestion, Sprout, Leaf, Bug, Microscope, type LucideIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AGRI_ENTITY_TYPES } from '@/constants/public'
import { cn } from '@/lib/utils'
import type { AgriEntityType } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { questionApi } from '@/api/client'
import { anveshanProgressEmitter } from '@/events/anveshanProgressEvents'
import type { AnveshanMilestoneData } from '@/pages/public/AnveshMileStone'

export type SubmissionTab = 'question' | AgriEntityType

// Tab order used to decide which way the content slides when switching.
const TAB_ORDER: SubmissionTab[] = ['question', 'crop', 'weed', 'pest', 'disease']

const INDICATOR_TRANSITION = { type: 'spring', stiffness: 500, damping: 38 } as const

// Returns 1 when the active tab moved right, -1 when it moved left, based on the previous render.
export function useTabDirection(tab: SubmissionTab): number {
  const [state, setState] = useState({ tab, direction: 1 })
  // Adjusting state during render when the tab changes (React's recommended pattern for derived state).
  if (state.tab !== tab) {
    const direction = TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(state.tab) ? 1 : -1
    setState({ tab, direction })
    return direction
  }
  return state.direction
}

interface SubmissionTabPanelProps {
  tab: SubmissionTab
  direction: number
  children: ReactNode
}

// Fades and slides the tab content in from the side the user moved towards. Respects reduced motion.
export function SubmissionTabPanel({ tab, direction, children }: SubmissionTabPanelProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        key={tab}
        initial={{ opacity: 0, x: 24 * direction }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </MotionConfig>
  )
}

// Reads the active tab from the URL, falling back to the question tab.
export function parseSubmissionTab(value: string | null): SubmissionTab {
  return AGRI_ENTITY_TYPES.some((type) => type.value === value) ? (value as AgriEntityType) : 'question'
}

export const SUBMISSION_TAB_ICONS: Record<SubmissionTab, LucideIcon> = {
  question: MessageCircleQuestion,
  crop: Sprout,
  weed: Leaf,
  pest: Bug,
  disease: Microscope,
}

// The question tab is done once its milestone goal is met; crop, weed, pest and disease need just one submission.
function isTabCompleted(tab: SubmissionTab, milestone: AnveshanMilestoneData | null | undefined): boolean {
  if (!milestone) return false
  if (tab === 'question') return milestone.progress.questions >= milestone.requirements.questions
  return milestone.progress[tab] >= 1
}

interface SubmissionTypeTabsProps {
  value: SubmissionTab
  onChange: (tab: SubmissionTab) => void
  /** Hide the Question tab where only crop / weed / pest / disease apply. */
  showQuestion?: boolean
}

/** Tab strip switching between question and crop / weed / pest / disease. */
export function SubmissionTypeTabs({ value, onChange, showQuestion = true }: SubmissionTypeTabsProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  
  const [milestone, setMilestone] = useState<AnveshanMilestoneData | null>(null)

  const loadMilestone = useCallback(() => {
    if (!user?.isAnveshanUser) return
    questionApi.getMyAnveshanMilestone().then(setMilestone).catch(() => undefined)
  }, [user?.isAnveshanUser])

  useEffect(() => {
    loadMilestone()
    return anveshanProgressEmitter.on(loadMilestone)
  }, [loadMilestone])

  const showAgriTabs = user?.isAnveshanUser || ['admin', 'curator', 'super_admin'].includes(user?.role ?? '')

  const tabs: { value: SubmissionTab; label: string }[] = [
    ...(showQuestion ? [{ value: 'question' as const, label: t('agriEntity.tabs.question', 'Question') }] : []),
    ...(showAgriTabs ? AGRI_ENTITY_TYPES.map((type) => ({ value: type.value, label: t(`agriEntity.tabs.${type.value}`, type.label) })) : []),
  ]

  // If there's only 1 tab (or 0), there's nothing to switch between, so hide the tab bar completely
  if (tabs.length <= 1) return null

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
  }[tabs.length] || 'grid-cols-1'

  return (
    <MotionConfig reducedMotion="user">
    <Tabs value={value} onValueChange={(v) => onChange(v as SubmissionTab)}>
      {/* Equal columns keep every tab visible without horizontal scrolling. On phones
          the icon sits over the label and the active tab uses a light tint rather than
          a solid fill so the strip stays compact; from sm up it switches to inline pills. */}
      <TabsList
        className={cn(
          'grid h-auto w-full gap-0.5 rounded-xl border border-border-subtle bg-surface p-1 sm:gap-1 sm:border-0 sm:bg-surface-variant',
          gridColsClass,
        )}
      >
        {tabs.map((tab) => {
          const Icon = SUBMISSION_TAB_ICONS[tab.value]
          const completed = isTabCompleted(tab.value, milestone)
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                'relative isolate flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1.5 text-[10.5px] font-medium text-text-tertiary',
                // The active background is the sliding indicator below, so the trigger itself stays transparent.
                'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                'max-sm:data-[state=active]:font-semibold max-sm:data-[state=active]:text-primary dark:max-sm:data-[state=active]:text-emerald-400',
                'sm:min-h-[44px] sm:flex-row sm:gap-2 sm:rounded-md sm:px-3 sm:text-sm sm:font-semibold sm:data-[state=inactive]:text-text-secondary',
              )}
            >
              {tab.value === value && (
                <motion.span
                  layoutId="submission-tab-indicator"
                  transition={INDICATOR_TRANSITION}
                  className="absolute inset-0 -z-10 rounded-lg bg-primary/15 sm:rounded-md sm:bg-primary sm:shadow-sm"
                  aria-hidden="true"
                />
              )}
              <Icon className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="max-w-full truncate leading-tight">{tab.label}</span>
              {completed && (
                <>
                  <CheckCircle2
                    className="absolute right-1 top-1 h-3.5 w-3.5 text-emerald-500 sm:static sm:h-4 sm:w-4"
                    aria-hidden="true"
                  />
                  <span className="sr-only">{t('agriEntity.tabs.completed', 'Completed')}</span>
                </>
              )}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
    </MotionConfig>
  )
}
