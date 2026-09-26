import { useTranslation } from 'react-i18next'
import { MessageCircleQuestion, Sprout, Leaf, Bug, Microscope, type LucideIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AGRI_ENTITY_TYPES } from '@/constants/public'
import { cn } from '@/lib/utils'
import type { AgriEntityType } from '@/types'
import { useAuth } from '@/context/AuthContext'

export type SubmissionTab = 'question' | AgriEntityType

// Reads the active tab from the URL, falling back to the question tab.
export function parseSubmissionTab(value: string | null): SubmissionTab {
  return AGRI_ENTITY_TYPES.some((type) => type.value === value) ? (value as AgriEntityType) : 'question'
}

const SUBMISSION_TAB_ICONS: Record<SubmissionTab, LucideIcon> = {
  question: MessageCircleQuestion,
  crop: Sprout,
  weed: Leaf,
  pest: Bug,
  disease: Microscope,
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
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                'flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1.5 text-[10.5px] font-medium text-text-tertiary',
                'max-sm:data-[state=active]:bg-primary/15 max-sm:data-[state=active]:font-semibold max-sm:data-[state=active]:text-primary max-sm:data-[state=active]:shadow-none dark:max-sm:data-[state=active]:text-emerald-400',
                'sm:min-h-[44px] sm:flex-row sm:gap-2 sm:rounded-md sm:px-3 sm:text-sm sm:font-semibold sm:data-[state=inactive]:text-text-secondary',
              )}
            >
              <Icon className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="max-w-full truncate leading-tight">{tab.label}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
