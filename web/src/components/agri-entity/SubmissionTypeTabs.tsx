import { useTranslation } from 'react-i18next'
import { MessageCircleQuestion, Sprout, Leaf, Bug, Microscope, type LucideIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AGRI_ENTITY_TYPES } from '@/constants/public'
import { cn } from '@/lib/utils'
import type { AgriEntityType } from '@/types'

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
  const tabs: { value: SubmissionTab; label: string }[] = [
    ...(showQuestion ? [{ value: 'question' as const, label: t('agriEntity.tabs.question', 'Question') }] : []),
    ...AGRI_ENTITY_TYPES.map((type) => ({ value: type.value, label: t(`agriEntity.tabs.${type.value}`, type.label) })),
  ]
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as SubmissionTab)}>
      {/* Equal columns so every tab stays visible without horizontal
          scrolling: icon stacked over the label on phones, inline from sm up. */}
      <TabsList className={cn('grid h-auto w-full gap-1 p-1', showQuestion ? 'grid-cols-5' : 'grid-cols-4')}>
        {tabs.map((tab) => {
          const Icon = SUBMISSION_TAB_ICONS[tab.value]
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] sm:flex-row sm:gap-2 sm:px-3 sm:text-sm"
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="max-w-full truncate">{tab.label}</span>
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
