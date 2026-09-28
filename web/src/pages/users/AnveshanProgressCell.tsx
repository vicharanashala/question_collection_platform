import { CheckCircle2 } from 'lucide-react'
import { InfoTip } from '@/components/anveshan-answers/InfoTip'
import { cn } from '@/lib/utils'
import type { AnveshanMilestoneCounts, AnveshanUserProgress } from '@/types'

const BREAKDOWN: { key: keyof AnveshanMilestoneCounts; label: string }[] = [
  { key: 'questions', label: 'Questions' },
  { key: 'crop', label: 'Crop' },
  { key: 'weed', label: 'Weed' },
  { key: 'pest', label: 'Pest' },
  { key: 'disease', label: 'Disease' },
  { key: 'answers', label: 'Answers' },
]

interface AnveshanProgressCellProps {
  progress: AnveshanUserProgress
}

// Compact milestone progress for the user table: bar, percentage and a per-goal breakdown tooltip.
export function AnveshanProgressCell({ progress }: AnveshanProgressCellProps) {
  const { percent, completed } = progress

  return (
    <InfoTip
      label={`Anveshan progress ${percent}%, show breakdown`}
      className="w-36 flex-col items-stretch gap-1 p-0.5 text-left"
      content={
        <div className="space-y-1">
          <p className="font-semibold">Anveshan progress: {percent}%</p>
          <ul className="space-y-0.5">
            {BREAKDOWN.map(({ key, label }) => {
              const done = progress.progress[key] >= progress.requirements[key]
              return (
                <li key={key} className="flex items-center justify-between gap-4">
                  <span>{label}</span>
                  <span className={cn('tabular-nums', done && 'font-semibold text-emerald-600 dark:text-emerald-400')}>
                    {progress.progress[key]}/{progress.requirements[key]} {done ? '✓' : ''}
                  </span>
                </li>
              )
            })}
          </ul>
          {!progress.submissionsCompleted && (
            <p className="text-[11px] opacity-80">Answers count after all submissions are done.</p>
          )}
        </div>
      }
    >
      <span className="flex items-center justify-between gap-2 text-[11px] font-semibold sm:text-xs">
        {completed ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Complete
          </span>
        ) : (
          <span className="text-text-secondary">{progress.submissionsCompleted ? 'Answering' : 'Submitting'}</span>
        )}
        <span className={cn('tabular-nums', completed ? 'text-emerald-700 dark:text-emerald-400' : 'text-text')}>{percent}%</span>
      </span>
      <span className="block h-1.5 overflow-hidden rounded-full bg-border-subtle" aria-hidden="true">
        <span
          className={cn('block h-full rounded-full', completed ? 'bg-emerald-500' : 'bg-primary')}
          style={{ width: `${percent}%` }}
        />
      </span>
    </InfoTip>
  )
}
