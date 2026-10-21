import { useEffect, useState } from 'react'
import { Clock, ImageIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SubmissionsPagination } from '@/components/submissions/SubmissionsPagination'
import { AgriEntityDetailModal } from '@/components/agri-entity/AgriEntityDetailModal'
import { SUBMISSION_TAB_ICONS } from '@/components/agri-entity/SubmissionTypeTabs'
import { AGRI_ENTITY_TYPES } from '@/constants/public'
import { cn, formatDateTime } from '@/lib/utils'
import type { AgriEntitySubmission, AgriEntityType } from '@/types'

const PAGE_SIZE = 12

// Entities the Anveshan user submitted, filtered by type, each opening the full detail dialog.
export function AnveshanEntitiesTab({ entities }: { entities: AgriEntitySubmission[] }) {
  const [type, setType] = useState<'' | AgriEntityType>('')
  const [selected, setSelected] = useState<AgriEntitySubmission | null>(null)
  const filtered = type ? entities.filter((e) => e.type === type) : entities
  const [page, setPage] = useState(1)

  // Back to the first page when the type filter changes.
  useEffect(() => setPage(1), [type])

  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const countOf = (value: AgriEntityType) => entities.filter((e) => e.type === value).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter entities by type">
        {[{ value: '' as const, label: 'All', count: entities.length }, ...AGRI_ENTITY_TYPES.map((t) => ({ ...t, count: countOf(t.value) }))].map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            onClick={() => setType(option.value)}
            aria-pressed={type === option.value}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              type === option.value ? 'border-primary bg-primary/10 text-primary' : 'border-border-subtle bg-surface-variant text-text-secondary hover:border-primary/40',
            )}
          >
            {option.label} <span className="tabular-nums opacity-70">({option.count})</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-text-secondary">No entities submitted</Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((entity) => {
            const TypeIcon = SUBMISSION_TAB_ICONS[entity.type]
            const submittedAt = entity.submissionLocation?.capturedAt ?? entity.createdAt
            return (
              <li key={entity.id}>
                <button
                  type="button"
                  onClick={() => setSelected(entity)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border-subtle bg-card p-3 text-left transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-focus"
                >
                  {entity.imageUrls[0] ? (
                    <img src={entity.imageUrls[0]} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg border border-border-subtle object-cover" />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                      <TypeIcon className="h-6 w-6" aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block truncate text-sm font-semibold text-foreground">{entity.englishName}</span>
                    <span className="block truncate text-xs text-text-secondary">{entity.localName}</span>
                    <span className="block truncate text-xs italic text-text-tertiary">{entity.botanicalName || '—'}</span>
                    <span className="flex items-center gap-3 pt-1 text-[11px] text-text-tertiary">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />{formatDateTime(submittedAt)}</span>
                      <span className="inline-flex items-center gap-1"><ImageIcon className="h-3 w-3" aria-hidden="true" />{entity.imageUrls.length}</span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {filtered.length > PAGE_SIZE && (
        <SubmissionsPagination page={page} limit={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      )}
      <AgriEntityDetailModal entity={selected} onClose={() => setSelected(null)} hideStatus />
    </div>
  )
}
