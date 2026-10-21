import { useEffect, useState } from 'react'
import { TesterFilter, type TesterFilterValue } from '@/components/TesterFilter'
import { TesterTag } from '@/components/TesterTag'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Clock, Download, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { agriEntityApi, getErrorMessage } from '@/api/client'
import { UserFilter } from '@/components/UserFilter'
import { isSuperAdmin } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type ColumnDef } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate as formatAbsoluteDate, formatTime } from '@/lib/utils'
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
  const [testerFilter, setTesterFilter] = useState<TesterFilterValue>('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AgriEntitySubmission | null>(null)
  const canFilterUsers = scope === 'all' && isSuperAdmin(user)
  const [userIds, setUserIds] = useState<string[]>([])
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [exporting, setExporting] = useState(false)

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
    list({
      type,
      status: status || undefined,
      page,
      limit: PAGE_SIZE,
      ...(scope === 'all' && testerFilter ? { tester: testerFilter } : {}),
      ...(scope === 'all' ? { sortOrder } : {}),
      ...(canFilterUsers && userIds.length ? { userIds } : {}),
    })
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
  }, [type, status, testerFilter, page, scope, sortOrder, userIds, canFilterUsers, t])

  // Applies or clears the selected users and returns to the first page.
  const applyUsers = (ids: string[]) => {
    setUserIds(ids)
    setPage(1)
  }

  // Downloads the Anveshan entities matching the current filters as an Excel file.
  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await agriEntityApi.exportAnveshan({
        type,
        sortOrder,
        ...(testerFilter ? { tester: testerFilter } : {}),
        ...(userIds.length ? { userIds } : {}),
      })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'))
    } finally {
      setExporting(false)
    }
  }

  // Columns for the staff table view.
  const adminColumns: ColumnDef<AgriEntitySubmission>[] = [
    { key: 'serial', header: '#', width: '56px', render: (row) => <span className="text-xs text-muted-foreground">{(page - 1) * PAGE_SIZE + items.indexOf(row) + 1}</span> },
    {
      key: 'entity',
      header: typeLabel,
      width: '300px',
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          {row.imageUrls[0] ? (
            <img src={row.imageUrls[0]} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg border border-border-subtle object-cover" />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TypeIcon className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{row.englishName}</p>
            <p className="truncate text-xs text-text-secondary">{row.localName}</p>
          </div>
        </div>
      ),
    },
    { key: 'botanical', header: 'Botanical Name', width: '220px', render: (row) => <span className="truncate text-sm italic text-text-secondary">{row.botanicalName || '—'}</span> },
    {
      key: 'images',
      header: 'Images',
      width: '100px',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {row.imageUrls.length}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      render: (row) =>
        row.status === 'pending' ? null : (
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', agriEntityStatusBadge(row.status))}>
            {agriEntityStatusLabel(t, row.status)}
          </span>
        ),
    },
    {
      key: 'submitter',
      header: 'User',
      width: '240px',
      render: (row) => (
        <div className="min-w-0 leading-tight">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm text-foreground">{submitterName(row)}</span>
            {row.submitter?.isTester && <TesterTag />}
          </div>
          {row.submitter?.mobileNumber && <p className="truncate text-xs text-muted-foreground">{row.submitter.mobileNumber}</p>}
        </div>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      width: '150px',
      render: (row) => {
        const submittedAt = row.submissionLocation?.capturedAt ?? row.createdAt
        return (
          <div className="leading-tight">
            <p className="text-sm text-foreground">{formatAbsoluteDate(submittedAt)}</p>
            <p className="text-xs text-muted-foreground">{formatTime(submittedAt)}</p>
          </div>
        )
      },
    },
  ]

  if (scope === 'all') {
    return (
      <>
        <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
          {!loading ? (
            <Badge variant="outline" className="w-fit whitespace-nowrap">
              {total} {typeLabel.toLowerCase()} {total === 1 ? 'submission' : 'submissions'}
            </Badge>
          ) : (
            <span />
          )}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {canFilterUsers && (
              <>
                <UserFilter value={userIds} onApply={applyUsers} tester={testerFilter || undefined} disabled={loading} />
              </>
            )}
            <div className="w-full sm:w-44">
              <TesterFilter value={testerFilter} onChange={(value) => { setTesterFilter(value); setPage(1) }} />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc')); setPage(1) }}
              aria-label="Toggle submission date order"
            >
              {sortOrder === 'desc' ? <ArrowDownWideNarrow className="mr-1.5 h-4 w-4" /> : <ArrowUpNarrowWide className="mr-1.5 h-4 w-4" />}
              {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
            </Button>
            {canFilterUsers && (
              <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
                <Download className="mr-1.5 h-4 w-4" />
                {exporting ? 'Exporting…' : 'Export Excel'}
              </Button>
            )}
          </div>
        </div>

        <DataTable
          data={items}
          columns={adminColumns}
          loading={loading}
          page={page}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          totalCount={total}
          onPageChange={setPage}
          hideSearch
          emptyMessage={`No ${typeLabel.toLowerCase()} submissions found`}
          onRowClick={setSelected}
        />

        <AgriEntityDetailModal entity={selected} onClose={() => setSelected(null)} />
      </>
    )
  }

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
