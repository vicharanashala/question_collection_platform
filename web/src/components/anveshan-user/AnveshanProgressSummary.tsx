import { useState } from 'react'
import { CheckCircle2, ChevronDown, Circle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AnveshanMilestoneCounts, AnveshanUserProgress } from '@/types'

const GOALS: { key: keyof AnveshanMilestoneCounts; label: string }[] = [
  { key: 'questions', label: 'Questions' },
  { key: 'crop', label: 'Crops' },
  { key: 'weed', label: 'Weeds' },
  { key: 'pest', label: 'Pests' },
  { key: 'disease', label: 'Diseases' },
  { key: 'answers', label: 'Answers' },
]

// Overall Anveshan progress, collapsed by default, with a tile for every milestone goal when expanded.
export function AnveshanProgressSummary({ progress }: { progress: AnveshanUserProgress | null }) {
  const [open, setOpen] = useState(false)
  if (!progress) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-text-secondary">Progress is not available for this user.</CardContent>
      </Card>
    )
  }
  const { percent, completed, submissionsCompleted } = progress
  const stage = completed ? 'Complete' : submissionsCompleted ? 'Answering questions' : 'Submitting'

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="anveshan-progress-goals"
          className="flex w-full items-center justify-between gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span className="flex items-baseline gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Anveshan progress</span>
            <span className="text-xl font-extrabold tabular-nums text-foreground">{percent}%</span>
          </span>
          <span className="flex items-center gap-3">
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold',
                completed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-primary/10 text-primary',
              )}
            >
              {stage}
            </span>
            <ChevronDown className={cn('h-4 w-4 text-text-secondary transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </span>
        </button>
        <div
          className="h-2.5 overflow-hidden rounded-full bg-border-subtle"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Overall Anveshan progress"
        >
          <div className={cn('h-full rounded-full', completed ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${percent}%` }} />
        </div>
        {open && (
        <ul id="anveshan-progress-goals" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {GOALS.map(({ key, label }) => {
            const done = progress.progress[key] >= progress.requirements[key]
            const Icon = done ? CheckCircle2 : Circle
            return (
              <li key={key} className="rounded-lg border border-border-subtle bg-surface-variant/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-text-secondary">{label}</span>
                  <Icon className={cn('h-4 w-4', done ? 'text-emerald-500' : 'text-text-tertiary')} aria-hidden="true" />
                </div>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                  {progress.progress[key]}
                  <span className="text-sm font-medium text-text-tertiary"> / {progress.requirements[key]}</span>
                </p>
                <span className="sr-only">{done ? 'Goal met' : 'Goal not met'}</span>
              </li>
            )
          })}
        </ul>
        )}
      </CardContent>
    </Card>
  )
}
