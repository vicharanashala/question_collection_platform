import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ROW_STAGGER_SECONDS = 0.03
const MAX_STAGGERED_ROWS = 10

// Placeholder rows shown while a submissions page loads, shaped like the real rows.
export function SubmissionListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-border-subtle" aria-busy="true" aria-label="Loading submissions">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 p-4 sm:p-5">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-surface-variant" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-surface-variant" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-variant" />
          </div>
        </li>
      ))}
    </ul>
  )
}

interface SubmissionEmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

// Friendly empty state with an optional call to action.
export function SubmissionEmptyState({ icon: Icon, title, description, actionLabel, onAction }: SubmissionEmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center sm:py-14">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
        <Icon className="h-7 w-7 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      </span>
      <p className="mt-4 text-sm font-semibold text-foreground sm:text-base">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-text-secondary sm:text-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5 bg-emerald-500 hover:bg-emerald-600">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

interface SubmissionRowProps {
  index: number
  onOpen: () => void
  /** Accessible name for the row, e.g. the question text. */
  label: string
  leading: ReactNode
  children: ReactNode
  /** Right-aligned content such as a status badge. */
  trailing?: ReactNode
}

// One clickable submission row: leading visual, content, optional badge and a chevron. Enters with a short stagger.
export function SubmissionRow({ index, onOpen, label, leading, children, trailing }: SubmissionRowProps) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index, MAX_STAGGERED_ROWS) * ROW_STAGGER_SECONDS }}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className={cn(
          'group flex w-full items-center gap-3 p-4 text-left transition-colors sm:gap-4 sm:p-5',
          'hover:bg-emerald-50/50 dark:hover:bg-emerald-950/15',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
        )}
      >
        {leading}
        <div className="min-w-0 flex-1">{children}</div>
        {trailing && <div className="hidden shrink-0 sm:block">{trailing}</div>}
        <ChevronRight
          className="h-4 w-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600"
          aria-hidden="true"
        />
      </button>
    </motion.li>
  )
}

interface MetaChipProps {
  icon: LucideIcon
  children: ReactNode
  className?: string
}

// Small icon + text detail used in a row's meta line.
export function MetaChip({ icon: Icon, children, className }: MetaChipProps) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  )
}

// "12 questions" style count shown above a list.
export function SubmissionCount({ total, label }: { total: number; label: string }) {
  return (
    <p className="px-1 text-xs font-medium text-text-secondary" aria-live="polite">
      <span className="font-semibold tabular-nums text-foreground">{total}</span> {label}
    </p>
  )
}
