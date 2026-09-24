import type { TFunction } from 'i18next'
import type { AgriEntityStatus, AgriEntitySubmission } from '@/types'

// Same colours as question statuses so the Submissions page reads consistently.
const STATUS_BADGE: Record<AgriEntityStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
}

export function agriEntityStatusBadge(status: AgriEntityStatus): string {
  return STATUS_BADGE[status] ?? 'bg-muted text-muted-foreground'
}

export function agriEntityStatusLabel(t: TFunction, status: AgriEntityStatus): string {
  return t(`submissions.${status}`)
}

// Name shown for the submitting user in staff views.
export function submitterName(entity: AgriEntitySubmission): string {
  if (!entity.submitter) return 'Unknown user'
  return entity.submitter.name || (entity.submitter.username ? `@${entity.submitter.username}` : 'Unnamed user')
}
