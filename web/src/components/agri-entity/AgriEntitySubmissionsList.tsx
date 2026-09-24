import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { agriEntityApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SubmissionStatusFilter, type StatusOption } from '@/components/submissions/SubmissionStatusFilter'
import { SubmissionsPagination } from '@/components/submissions/SubmissionsPagination'
import { useRelativeTime } from '@/components/submissions/useRelativeTime'
import type { AgriEntityStatus, AgriEntitySubmission, AgriEntityType } from '@/types'
import { AgriEntityDetailModal } from './AgriEntityDetailModal'
import { agriEntityStatusBadge, agriEntityStatusLabel } from './agriEntityStatus'

const PAGE_SIZE = 20

interface AgriEntitySubmissionsListProps {
  type: AgriEntityType
  /** Translated type name, e.g. "Weed". */
  typeLabel: string
}

/** The signed-in user's crop / weed / pest / disease submissions of one type. */
export function AgriEntitySubmissionsList({ type, typeLabel }: AgriEntitySubmissionsListProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const formatDate = useRelativeTime()
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
    agriEntityApi
      .listMine({ type, status: status || undefined, page, limit: PAGE_SIZE })
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
  }, [type, status, page, t])

  return (
    <>
      <SubmissionStatusFilter options={statusOptions} value={status} onChange={(s) => { setStatus(s); setPage(1) }} />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
          ) : items.length === 0 ? (
            <div className="p-8 sm:p-10 text-center">
              <p className="text-xs sm:text-sm font-medium text-text-secondary">
                {t('agriEntity.noSubmissions', { type: typeLabel.toLowerCase(), defaultValue: 'No {{type}} submissions yet' })}
              </p>
              <Button onClick={() => navigate(`/home/ask?tab=${type}`)} className="mt-3 bg-emerald-500 hover:bg-emerald-600">
                <Plus className="h-4 w-4" /> {t('agriEntity.submit', { type: typeLabel, defaultValue: 'Submit {{type}}' })}
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="p-4 sm:p-5 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors cursor-pointer"
                  onClick={() => setSelected(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelected(item)
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    {item.imageUrls[0] && (
                      <img src={item.imageUrls[0]} alt="" className="h-12 w-12 shrink-0 rounded-md border border-border-subtle object-cover" loading="lazy" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-xs sm:text-sm font-medium text-foreground">
                          {item.englishName} <span className="text-text-secondary">· {item.localName}</span>
                        </p>
                        <p className="truncate text-[11px] sm:text-xs italic text-text-tertiary">{item.botanicalName}</p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-text-tertiary">
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', agriEntityStatusBadge(item.status))}>
                          {agriEntityStatusLabel(t, item.status)}
                        </span>
                        <span>·</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
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
