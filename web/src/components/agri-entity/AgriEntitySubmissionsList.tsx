import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Clock, Image as ImageIcon, User as UserIcon } from 'lucide-react'
import { toast } from 'sonner'
import { agriEntityApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SubmissionStatusFilter, type StatusOption } from '@/components/submissions/SubmissionStatusFilter'
import { SubmissionsPagination } from '@/components/submissions/SubmissionsPagination'
import { useRelativeTime } from '@/components/submissions/useRelativeTime'
import { MetaChip, SubmissionCount, SubmissionEmptyState, SubmissionListSkeleton, SubmissionRow } from '@/components/submissions/SubmissionListParts'
import { SUBMISSION_TAB_ICONS } from './SubmissionTypeTabs'
import type { AgriEntityStatus, AgriEntitySubmission, AgriEntityType } from '@/types'
import { AgriEntityDetailModal } from './AgriEntityDetailModal'
import { agriEntityStatusBadge, agriEntityStatusLabel, submitterName } from './agriEntityStatus'

const PAGE_SIZE = 20

interface AgriEntitySubmissionsListProps {
  type: AgriEntityType
  /** Translated type name, e.g. "Weed". */
  typeLabel: string
  /** "mine" = the signed-in user's records; "all" = every user's, for staff. */
  scope?: 'mine' | 'all'
}

/** Crop / weed / pest / disease submissions of one type. */
export function AgriEntitySubmissionsList({ type, typeLabel, scope = 'mine' }: AgriEntitySubmissionsListProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const formatDate = useRelativeTime()
  const { user } = useAuth()
  // Anveshan users do not see review status on their own submissions.
  const hideStatus = scope === 'mine' && !!user?.isAnveshanUser
  const TypeIcon = SUBMISSION_TAB_ICONS[type]
  const [items, setItems] = useState<AgriEntitySubmission[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'' | AgriEntityStatus>('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AgriEntitySubmission | null>(null)

  const statusOptions: StatusOption<'' | AgriEntityStatus>[] = [
    { key: '', label: t('submissions.allStatus') },
    { key: 'pending', label: t('submissions.pending') },
    { key: 'approved', label: t('submissions.approved') },
    { key: 'rejected', label: t('submissions.rejected') },
  ]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const list = scope === 'all' ? agriEntityApi.listAll : agriEntityApi.listMine
    list({ type, status: status || undefined, page, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        setItems(res.items ?? [])
        setTotal(res.total ?? 0)
      })
      .catch((err) => {
        if (!cancelled) toast.error(getErrorMessage(err, t('submissions.loadError')))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [type, status, page, scope, t])

  return (
    <>
      {!hideStatus && (
        <SubmissionStatusFilter options={statusOptions} value={status} onChange={(s) => { setStatus(s); setPage(1) }} />
      )}

      {!loading && total > 0 && (
        <SubmissionCount
          total={total}
          label={t('agriEntity.count', { type: typeLabel.toLowerCase(), defaultValue: `${typeLabel.toLowerCase()} submission${total === 1 ? '' : 's'}` })}
        />
      )}

      <Card className="overflow-hidden rounded-xl">
        <CardContent className="p-0">
          {loading ? (
            <SubmissionListSkeleton />
          ) : items.length === 0 ? (
            <SubmissionEmptyState
              icon={TypeIcon}
              title={t('agriEntity.noSubmissions', { type: typeLabel.toLowerCase(), defaultValue: 'No {{type}} submissions yet' })}
              description={
                scope === 'mine'
                  ? t('agriEntity.emptyHint', { type: typeLabel.toLowerCase(), defaultValue: 'Share a {{type}} with its names, sources and photos. It will appear here.' })
                  : undefined
              }
              actionLabel={scope === 'mine' ? t('agriEntity.submit', { type: typeLabel, defaultValue: 'Submit {{type}}' }) : undefined}
              onAction={scope === 'mine' ? () => navigate(`/home/ask?tab=${type}`) : undefined}
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {items.map((item, index) => {
                const badge = hideStatus ? null : (
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', agriEntityStatusBadge(item.status))}>
                    {agriEntityStatusLabel(t, item.status)}
                  </span>
                )
                return (
                  <SubmissionRow
                    key={item.id}
                    index={index}
                    label={`${item.englishName}, ${item.localName}`}
                    onOpen={() => setSelected(item)}
                    trailing={badge}
                    leading={
                      item.imageUrls[0] ? (
                        <img
                          src={item.imageUrls[0]}
                          alt=""
                          loading="lazy"
                          className="h-14 w-14 shrink-0 rounded-lg border border-border-subtle object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <TypeIcon className="h-6 w-6" aria-hidden="true" />
                        </span>
                      )
                    }
                  >
                    <p className="truncate text-sm font-semibold text-foreground">
                      {item.englishName} <span className="font-normal text-text-secondary">· {item.localName}</span>
                    </p>
                    <p className="truncate text-xs italic text-text-tertiary">{item.botanicalName}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-tertiary sm:text-xs">
                      {badge && <span className="sm:hidden">{badge}</span>}
                      <MetaChip icon={Clock}>{formatDate(item.createdAt)}</MetaChip>
                      {item.imageUrls.length > 1 && <MetaChip icon={ImageIcon}>{item.imageUrls.length}</MetaChip>}
                      {scope === 'all' && <MetaChip icon={UserIcon}>{submitterName(item)}</MetaChip>}
                    </div>
                  </SubmissionRow>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {!loading && items.length > 0 && (
        <SubmissionsPagination page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
      )}

      <AgriEntityDetailModal entity={selected} onClose={() => setSelected(null)} />
    </>
  )
}
