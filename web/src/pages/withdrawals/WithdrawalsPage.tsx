import { useState, useEffect, useCallback } from 'react'
import { adminApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatDate } from '@/lib/utils'
import {
  CreditCard, ChevronLeft, ChevronRight, Search,
  CheckCircle, XCircle, RefreshCw, Filter, X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Withdrawal } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-warning text-white',
  processing: 'bg-ai_review text-white',
  completed:  'bg-success text-white',
  failed:     'bg-destructive text-white',
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]

const SORT_OPTIONS = [
  { value: 'createdAt:DESC', label: 'Newest First' },
  { value: 'createdAt:ASC', label: 'Oldest First' },
  { value: 'amount:DESC', label: 'Highest Amount' },
  { value: 'amount:ASC', label: 'Lowest Amount' },
]

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand',
  'Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura',
  'Uttar Pradesh','Uttarakhand','West Bengal',
]

function buildParams(
  page: number,
  active: { search: string; status: string; state: string; sortBy: string; fromDate: string; toDate: string },
) {
  const params: Record<string, string | number> = { page, limit: 20 }
  if (active.search)   params.search   = active.search
  if (active.status)   params.status   = active.status
  if (active.state)    params.state    = active.state
  if (active.fromDate) params.fromDate = active.fromDate
  if (active.toDate)   params.toDate   = active.toDate
  const sortBy   = active.sortBy.split(':')[0]
  const sortOrder = active.sortBy.split(':')[1]
  if (sortBy !== 'createdAt')   params.sortBy   = sortBy
  if (sortOrder)                params.sortOrder = sortOrder
  return params
}

export function WithdrawalsPage() {
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [items, setItems] = useState<Withdrawal[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // Filters
  const [filterOpen, setFilterOpen] = useState(false)
  const [activeFilters, setActiveFilters] = useState({
    search: '', status: '', state: '', sortBy: 'createdAt:DESC', fromDate: '', toDate: '',
  })
  const [draftFilters, setDraftFilters] = useState({ ...activeFilters })

  const limit = 20
  const totalPages = Math.ceil(total / limit)

  const fetch = useCallback(async (pageNum = 1, refresh = false, filters = activeFilters) => {
    try {
      const params = buildParams(pageNum, filters)
      const res = await adminApi.listWithdrawals(params)
      setItems(refresh ? res.items : (prev) => [...prev, ...res.items])
      setTotal(res.total)
      setPage(pageNum)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load withdrawals'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeFilters])

  useEffect(() => { fetch(1, true, activeFilters) }, [])

  async function onRefresh() {
    setRefreshing(true)
    await fetch(1, true, activeFilters)
  }

  async function loadMore() {
    if (page >= totalPages || loading) return
    await fetch(page + 1, false, activeFilters)
  }

  function openFilters() {
    setDraftFilters(activeFilters)
    setFilterOpen(true)
  }

  function applyFilters() {
    setActiveFilters(draftFilters)
    setPage(1)
    setItems([])
    setLoading(true)
    fetch(1, true, draftFilters)
    setFilterOpen(false)
  }

  function resetFilters() {
    const empty = { search: '', status: '', state: '', sortBy: 'createdAt:DESC', fromDate: '', toDate: '' }
    setDraftFilters(empty)
    setActiveFilters(empty)
    setPage(1)
    setItems([])
    setLoading(true)
    fetch(1, true, empty)
    setFilterOpen(false)
  }

  async function handleAction(id: string, action: 'approve' | 'reject', reason?: string) {
    setProcessingId(id)
    try {
      await adminApi.processWithdrawal(id, { action, failureReason: reason })
      setItems((prev) => prev.filter((w) => w.id !== id))
      toast.success(`Withdrawal ${action === 'approve' ? 'approved' : 'rejected'}`)
    } catch (e) {
      toast.error(getErrorMessage(e, `Failed to ${action}`))
    } finally {
      setProcessingId(null)
    }
  }

  function activeFilterCount() {
    return Object.entries(activeFilters).filter(([k, v]) => {
      if (k === 'sortBy') return v !== 'createdAt:DESC'
      return v && v.trim().length > 0
    }).length
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Withdrawals
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {total.toLocaleString('en-IN')} withdrawal{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={openFilters}>
            <Filter className="h-4 w-4 mr-1.5" />
            Filters
            {activeFilterCount() > 0 && (
              <Badge variant="default" className="ml-1.5 h-5 w-5 p-0 justify-center items-center text-xs">
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
            if (k === 'sortBy') return v !== 'createdAt:DESC'
            return v && v.trim().length > 0
          }).map(([k, v]) => (
            <Badge key={k} variant="secondary" className="flex items-center gap-1 px-2 py-1 text-xs">
              <span className="text-muted-foreground capitalize">{k}:</span> {v}
              <button
                onClick={() => {
                  const next = { ...activeFilters, [k]: k === 'sortBy' ? 'createdAt:DESC' : '' }
                  setActiveFilters(next)
                  setPage(1); setItems([]); setLoading(true)
                  fetch(1, true, next)
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="text-xs h-6" onClick={resetFilters}>
            Clear all
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Method</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Amount</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Requested</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Processed</th>
                {(isSuperAdmin) && <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No withdrawals match your filters
                  </td>
                </tr>
              ) : (
                items.map((w) => (
                  <tr key={w.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {w.user?.name ?? w.user?.mobileNumber ?? 'Unknown'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {w.user?.mobileNumber ?? ''} · {w.user?.state ?? ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{w.payoutMethod}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                      ₹{Number(w.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-semibold', STATUS_COLORS[w.status] ?? 'bg-muted')}>
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
                      <td className="px-4 py-3">
                        {w.status === 'pending' ? (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-success hover:text-success hover:bg-success/10"
                              onClick={() => handleAction(w.id, 'approve')}
                              disabled={processingId === w.id}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                const reason = window.prompt('Rejection reason (optional):')
                                handleAction(w.id, 'reject', reason ?? undefined)
                              }}
                              disabled={processingId === w.id}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {w.failureReason && (
                          <p className="text-xs text-destructive mt-1">{w.failureReason}</p>
                        )}
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
            <p className="text-xs text-muted-foreground">
              Showing {items.length} of {total.toLocaleString('en-IN')} results
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setPage(1); setItems([]); setLoading(true); fetch(1, true, activeFilters) }}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">Page {page} of {totalPages}</span>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filter Withdrawals</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Search</Label>
              <Input
                placeholder="Name or mobile number…"
                value={draftFilters.search}
                onChange={(e) => setDraftFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draftFilters.status}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draftFilters.state}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, state: e.target.value }))}
                >
                  <option value="">All States</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sort By</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={draftFilters.fromDate}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, fromDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={draftFilters.toDate}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, toDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFilterOpen(false)}>Cancel</Button>
            <Button variant="secondary" onClick={resetFilters}>Reset</Button>
            <Button onClick={applyFilters}>Apply Filters</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}