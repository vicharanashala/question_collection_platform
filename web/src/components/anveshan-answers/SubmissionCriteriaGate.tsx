import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Bug, CheckCircle2, Leaf, Lock, MessageSquareText, Microscope, Sprout, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AnveshanMilestoneCounts } from '@/types'

type CriterionKey = Exclude<keyof AnveshanMilestoneCounts, 'answers'>

const CRITERIA: { key: CriterionKey; icon: LucideIcon; label: string; to: string }[] = [
  { key: 'questions', icon: MessageSquareText, label: 'Questions', to: '/home/ask' },
  { key: 'crop', icon: Sprout, label: 'Crop', to: '/home/ask?tab=crop' },
  { key: 'weed', icon: Leaf, label: 'Weed', to: '/home/ask?tab=weed' },
  { key: 'pest', icon: Bug, label: 'Pest', to: '/home/ask?tab=pest' },
  { key: 'disease', icon: Microscope, label: 'Disease', to: '/home/ask?tab=disease' },
]

interface SubmissionCriteriaGateProps {
  requirements: AnveshanMilestoneCounts
  progress: AnveshanMilestoneCounts
}

// Blocks the answer phase and lists which submission criteria are still pending, each linking to its form.
export function SubmissionCriteriaGate({ requirements, progress }: SubmissionCriteriaGateProps) {
  const { t } = useTranslation()
  const firstPending = CRITERIA.find(({ key }) => progress[key] < requirements[key])

  return (
    <Card className="mx-auto max-w-xl px-5 py-8 sm:px-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-text">
          {t('anveshanAnswers.gateTitle', 'Complete your submissions first')}
        </h1>
        <p className="text-sm text-text-secondary">
          {t(
            'anveshanAnswers.gateDescription',
            'You need to complete the submission criteria below before entering the answer phase. Once every item is done, you can come back here to answer your questions.',
          )}
        </p>
      </div>

      <ul className="mt-5 space-y-2" aria-label={t('anveshanAnswers.gateListLabel', 'Submission criteria')}>
        {CRITERIA.map(({ key, icon: Icon, label, to }) => {
          const required = requirements[key]
          const done = progress[key] >= required
          const remaining = Math.max(0, required - progress[key])
          return (
            <li
              key={key}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                done
                  ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/25'
                  : 'border-border-subtle bg-surface',
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  done ? 'bg-emerald-500 text-white' : 'bg-surface-variant text-text-secondary',
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{t(`anveshanAnswers.criteria.${key}`, label)}</p>
                <p className={cn('text-xs', done ? 'text-emerald-700 dark:text-emerald-400' : 'text-text-tertiary')}>
                  {done
                    ? t('anveshanAnswers.criteriaDone', 'Completed')
                    : t('anveshanAnswers.criteriaRemaining', { count: remaining, defaultValue: '{{count}} more to submit' })}
                </p>
              </div>
              <span className="text-xs font-semibold tabular-nums text-text-tertiary" aria-label={`${progress[key]} of ${required}`}>
                {progress[key]}/{required}
              </span>
              {!done && (
                <Link
                  to={to}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {t('anveshanAnswers.criteriaGo', 'Submit')}
                </Link>
              )}
            </li>
          )
        })}
      </ul>

      <Button asChild className="mt-5 w-full gap-1.5">
        <Link to={firstPending?.to ?? '/home/ask'}>
          {t('anveshanAnswers.goSubmit', 'Continue submitting')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </Card>
  )
}
