import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi, getErrorMessage, type LgdState } from '@/client/client'
import { useInfiniteWithdrawals, useProcessWithdrawal } from '@/hooks/api/useWithdrawals'
import { useStates } from '@/hooks/api/useLgd'
import { useAuth } from '@/stores/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatDate } from '@/lib/utils'
import { WalletDetailModal } from '@/components/WalletDetailModal'
import { WithdrawalDetailModal } from '@/components/WithdrawalDetailModal'
import { ReasonDialog } from '@/components/ReasonDialog'
import {
  CreditCard, ChevronLeft, ChevronRight,
  RefreshCw, Filter, X, Eye
} from 'lucide-react'
import { toast } from 'sonner'
import type { Withdrawal } from '@/types'
import { ExportMenu } from '@/components/ExportMenu'
import { TesterTag } from '@/components/TesterTag'
import { exportDate, type ExportColumn } from '@/lib/exportData'
import { useTranslation } from 'react-i18next'

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-warning text-white',
  processing: 'bg-blue-500 text-white',
  completed:  'bg-success text-white',
  rejected:   'bg-destructive text-white',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
  { value: 'failed_pending_tx', label: 'Failed (Pending Refund)' },
]

const SORT_OPTIONS = [
  { value: '_default',         label: 'Default (Pending First)' },
  { value: 'createdAt:DESC',   label: 'Newest First' },
  { value: 'createdAt:ASC',    label: 'Oldest First' },
  { value: 'amount:DESC',      label: 'Highest Amount' },
  { value: 'amount:ASC',       label: 'Lowest Amount' },
]

function buildParams(
  page: number,
  active: { search: string; status: string; state: string; sortBy: string; fromDate: string; toDate: string; filterStatus?: string; tester?: string },
) {
  const params: Record<string, string | number> = { page, limit: 20 }
  if (active.search)   params.search   = active.search
  if (active.state)    params.state    = active.state
  if (active.fromDate) params.fromDate = active.fromDate
  if (active.toDate)   params.toDate   = active.toDate
  if (active.tester)   params.tester   = active.tester
  const SPECIAL_FILTERS = ['failed_pending_tx']
  if (SPECIAL_FILTERS.includes(active.status)) {
    params.filterStatus = active.status
  } else if (active.status) {
    params.status = active.status
  }

  if (active.sortBy === '_default') {
    // No backend sort — pending-first sort is applied client-side after fetching
  } else {
    const sortBy   = active.sortBy.split(':')[0]
    const sortOrder = active.sortBy.split(':')[1]
    if (sortBy)   params.sortBy   = sortBy
    if (sortOrder) params.sortOrder = sortOrder
  }
  return params
}

function pendingFirst(a: Withdrawal, b: Withdrawal) {
  if (a.status === 'pending' && b.status !== 'pending') return -1
  if (a.status !== 'pending' && b.status === 'pending') return 1
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

const WITHDRAWAL_EXPORT_COLUMNS: ExportColumn<Withdrawal>[] = [
  { header: 'Requested', value: (w) => exportDate(w.createdAt, true) },
  { header: 'Processed', value: (w) => exportDate(w.processedAt, true) },
  { header: 'Name', value: (w) => w.user?.name },
  { header: 'Mobile', value: (w) => w.user?.mobileNumber },
  { header: 'Tester', value: (w) => (w.user?.isTester ? 'TRUE' : 'FALSE') },
  { header: 'State', value: (w) => w.user?.state },
  { header: 'Method', value: (w) => w.payoutMethod },
  { header: 'Amount (INR)', value: (w) => Number(w.amount) },
  { header: 'Status', value: (w) => w.status },
  { header: 'UTR', value: (w) => w.utrNumber },
  { header: 'Rejection Reason', value: (w) => w.rejectionReason },
  { header: 'Failure Reason', value: (w) => w.failureReason },
  { header: 'Retries', value: (w) => w.retryCount },
]

export function WithdrawalsPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [processingId, setProcessingId] = useState<string | null>(null)
  const processWithdrawal = useProcessWithdrawal()
  const [walletUserId, setWalletUserId] = useState<string | null>(null)
  const [walletOpen, setWalletOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState<Withdrawal | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [reasonDialog, setReasonDialog] = useState<{
    open: boolean
    withdrawalId: string
    mode: 'approve' | 'reject' | 'fail'
    amount: number
    userName: string
  } | null>(null)

  // Filters
  const [filterOpen, setFilterOpen] = useState(false)
  const { data: statesData, error: statesError } = useStates()
  const states: LgdState[] = statesData?.states ?? []

  useEffect(() => {
    if (statesError) toast.error(getErrorMessage(statesError, 'Failed to load states'))
  }, [statesError])
  const [activeFilters, setActiveFilters] = useState({
    search: '', status: '', state: '', sortBy: '_default', fromDate: '', toDate: '', filterStatus: '', tester: '',
  })
  const [draftFilters, setDraftFilters] = useState({ ...activeFilters })

  const limit = 20

  // buildParams also sets page; the infinite query supplies the real page number.
  const listParams = buildParams(1, activeFilters)
  const listQuery = useInfiniteWithdrawals(listParams)
  const listPages = listQuery.data?.pages ?? []
  // Pending-first sort is applied client-side per page when _default is active.
  const items: Withdrawal[] = listPages.flatMap((p) =>
    activeFilters.sortBy === '_default' ? [...p.items].sort(pendingFirst) : p.items,
  )
  const total = listPages.length > 0 ? listPages[listPages.length - 1].total : 0
  const page = Math.max(listPages.length, 1)
  const totalPages = Math.ceil(total / limit)
  const loading = listQuery.isFetching
  const refreshing = listQuery.isRefetching

  useEffect(() => {
    if (listQuery.error) toast.error(getErrorMessage(listQuery.error, 'Failed to load withdrawals'))
  }, [listQuery.error])

  async function onRefresh() {
    await listQuery.refetch()
  }

  async function loadMore() {
    if (!listQuery.hasNextPage || listQuery.isFetchingNextPage) return
    await listQuery.fetchNextPage()
  }

  function openFilters() {
    setDraftFilters(activeFilters)
    setFilterOpen(true)
  }

  function applyFilters() {
    const toApply = { ...draftFilters }
    setActiveFilters(toApply)
    setFilterOpen(false)
  }

  function resetFilters() {
    const empty = { search: '', state: '', sortBy: '_default', fromDate: '', toDate: '', filterStatus: '', status: '', tester: '' }
    setDraftFilters(empty)
    setActiveFilters(empty)
    setFilterOpen(false)
  }

  async function handleAction(
  id: string,
  action: 'approve' | 'reject' | 'reject_open' | 'fail',
  reason?: string,
) {
  if (processingId !== null) return

  if (action === 'reject_open' || action === 'fail') {
    const w = items.find((q) => q.id === id)

    setReasonDialog({
      open: true,
      withdrawalId: id,
      mode: action === 'fail' ? 'fail' : 'reject',
      amount: w?.amount ?? 0,
      userName: w?.user?.name ?? w?.user?.mobileNumber ?? '',
    })

    return
  }

  setProcessingId(id)

  try {
    await processWithdrawal.mutateAsync({
      id,
      body: { action, rejectionReason: reason },
    })

    toast.success(
      `Withdrawal ${action === 'approve' ? 'approved' : 'rejected'}`,
    )

  } catch (e) {
    toast.error(getErrorMessage(e, `Failed to ${action}`))
  } finally {
    setProcessingId(null)
  }
}

  function activeFilterCount() {
    return Object.entries(activeFilters).filter(([k, v]) => {
      if (k === 'sortBy') return v !== '_default'
      return v && v.trim().length > 0
    }).length
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            {t('nav.withdrawals')}
          </h2>
          <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground mt-1">
            {total.toLocaleString('en-IN')} withdrawal{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            name="withdrawals"
            columns={WITHDRAWAL_EXPORT_COLUMNS}
            disabled={total === 0}
            sort={activeFilters.sortBy === '_default' ? pendingFirst : undefined}
            fetchPage={(page, limit) => adminApi.listWithdrawals({ ...buildParams(page, activeFilters), limit })}
          />
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
          <Button variant="outline" size="sm" onClick={openFilters}>
            <Filter className="h-4 w-4 mr-1.5" />
            Filters
            {activeFilterCount() > 0 && (
              <Badge variant="default" className="ml-1.5 h-5 w-5 p-0 justify-center items-center text-[11px] sm:text-[11px] sm:text-xs">
                {activeFilterCount()}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Active filter pills */}
      {activeFilterCount() > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(activeFilters).filter(([k, v]) => {
            if (k === 'sortBy') return v !== '_default'
            return v && v.trim().length > 0
          }).map(([k, v]) => (
            <Badge key={k} variant="secondary" className="flex items-center gap-1 px-2 py-1 text-[11px] sm:text-[11px] sm:text-xs">
              <span className="text-muted-foreground capitalize">{k}:</span> {v}
              <button
                onClick={() => {
                  const next = { ...activeFilters, [k]: k === 'sortBy' ? '_default' : '' }
                  setActiveFilters(next)
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="text-[11px] sm:text-[11px] sm:text-xs h-6" onClick={resetFilters}>{t('dataTable.clearAll')}</Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-xs sm:text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t('roles.user')}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t('wallet.withdrawal.method')}</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">{t('wallet.withdrawal.amount')}</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">{t('submissions.status')}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t('withdrawalsPage.requested')}</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">{t('withdrawalsPage.processed')}</th>
                {(isSuperAdmin) && <th className="text-center px-4 py-3 font-semibold text-muted-foreground">{t('nav.wallet')}</th>}
                {(isSuperAdmin) && <th className="text-center px-4 py-3 font-semibold text-muted-foreground">{t('stepDetails')}</th>}
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: isSuperAdmin ? 8 : 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 8 : 7} className="text-center py-12 text-muted-foreground">{t('withdrawalsPage.noWithdrawalsMatchYour')}</td>
                </tr>
              ) : (
                items.map((w) => (
                  <tr key={w.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                          type="button"
                          className="font-medium text-primary hover:underline text-left"
                          onClick={() => navigate(`/users/${w.user?.id}`)}
                        >
                          {w.user?.name ?? w.user?.mobileNumber ?? 'Unknown'}
                        </button>
                      {w.user?.isTester && <span className="ml-2 align-middle"><TesterTag /></span>}
                      <div className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">
                        {w.user?.mobileNumber ?? ''} · {w.user?.state ?? ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{w.payoutMethod}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                      ₹{Number(w.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] sm:text-[11px] sm:text-xs font-semibold', STATUS_COLORS[w.status] ?? 'bg-muted')}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(w.createdAt) ?? new Date(w.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {w.processedAt
                        ? (formatDate(w.processedAt) ?? new Date(w.processedAt).toLocaleDateString('en-IN'))
                        : '—'}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-primary hover:text-primary"
                          onClick={() => {
                            if (!w.user?.id) return
                            setWalletUserId(w.user.id)
                            setWalletOpen(true)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {t('admin.view')}
                        </Button>
                      </td>
                    )}
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-primary hover:text-primary"
                          onClick={() => {
                            setDetailTarget(w)
                            setDetailOpen(true)
                          }}
                          disabled={processingId === w.id}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {t('stepDetails')}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">{t('withdrawalsPage.showingOfResults', { length: items.length, value3: total.toLocaleString('en-IN') })}</p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void listQuery.refetch()}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs sm:text-xs sm:text-sm px-2">{t('usersPage.pageOf', { page, totalPages })}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Filter modal */}
      <Dialog open={filterOpen} onOpenChange={(o) => !o && setFilterOpen(false)}>
        <DialogContent className="gap-5 p-6">
          <DialogHeader>
            <DialogTitle>{t('withdrawalsPage.filterWithdrawals')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('common.search')}</Label>
              <Input
                placeholder={t('withdrawalsPage.nameOrMobileNumber')}
                value={draftFilters.search}
                onChange={(e) => setDraftFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('submissions.status')}</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-xs sm:text-sm"
                  value={draftFilters.status}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('admin.state')}</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-xs sm:text-sm"
                  value={draftFilters.state}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, state: e.target.value }))}
                >
                  <option value="">{t('admin.allStates')}</option>
                  {states.map((s) => (
                    <option key={s.code} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('withdrawalsPage.accounts')}</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-xs sm:text-sm"
                  value={draftFilters.tester}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, tester: e.target.value }))}
                >
                  <option value="">{t('withdrawalsPage.allAccounts')}</option>
                  <option value="only">{t('withdrawalsPage.testersOnly')}</option>
                  <option value="exclude">{t('withdrawalsPage.excludeTesters')}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('common.sortBy')}</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-xs sm:text-sm"
                  value={draftFilters.sortBy}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, sortBy: e.target.value }))}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('withdrawalsPage.fromDate')}</Label>
                <Input
                  type="date"
                  value={draftFilters.fromDate}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, fromDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('withdrawalsPage.toDate')}</Label>
                <Input
                  type="date"
                  value={draftFilters.toDate}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, toDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFilterOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="secondary" onClick={resetFilters}>{t('submissions.reset')}</Button>
            <Button onClick={applyFilters}>{t('submissions.applyFilters')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wallet detail modal */}
      {walletUserId && (
        <WalletDetailModal
          key={walletUserId}
          userId={walletUserId}
          open={walletOpen}
          onClose={() => { setWalletOpen(false); setWalletUserId(null) }}
        />
      )}

      {/* Withdrawal detail modal */}
      {detailTarget && (
        <WithdrawalDetailModal
          withdrawal={detailTarget}
          open={detailOpen}
          onClose={() => { setDetailOpen(false); setDetailTarget(null) }}
          onActioned={() => {
            // The mutation invalidates the list; just close the modal.
            setDetailOpen(false)
            setDetailTarget(null)
          }}
        />
      )}

      {/* Reason dialog for withdrawal rejection (table-level) */}
      {reasonDialog && (
        <ReasonDialog
          open={reasonDialog.open}
          onOpenChange={(open) => setReasonDialog((prev) => prev ? { ...prev, open } : null)}
          mode={reasonDialog.mode}
          amount={reasonDialog.amount}
          userName={reasonDialog.userName}
          onConfirm={(reason) => handleAction(reasonDialog.withdrawalId, 'reject', reason)}
        />
      )}
    </div>
  )
}