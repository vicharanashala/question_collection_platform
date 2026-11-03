import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adminApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatINRFull } from '@/lib/utils'
import { WalletDetailModal } from '@/components/WalletDetailModal'
import {
  Wallet, Search, RefreshCw, X, TrendingUp,
  TrendingDown, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import type { WalletScopeFilters, WalletSummary, WalletTotals } from '@/types'
import { ExportMenu } from '@/components/ExportMenu'
import { TesterFilter, type TesterFilterValue } from '@/components/TesterFilter'
import { TesterTag } from '@/components/TesterTag'
import type { ExportColumn } from '@/lib/exportData'
import { useTesterScope } from '@/lib/testerMode'

const WALLET_EXPORT_COLUMNS: ExportColumn<WalletSummary>[] = [
  { header: 'Name', value: (w) => w.user.name },
  { header: 'Mobile', value: (w) => w.user.mobileNumber },
  { header: 'Tester', value: (w) => (w.user.isTester ? 'TRUE' : 'FALSE') },
  { header: 'State', value: (w) => w.user.state },
  { header: 'Category', value: (w) => w.user.category },
  { header: 'Status', value: (w) => w.user.verificationStatus },
  { header: 'Balance (INR)', value: (w) => Number(w.balance) },
  { header: 'Total Earned (INR)', value: (w) => Number(w.totalEarned) },
  { header: 'Total Withdrawn (INR)', value: (w) => Number(w.totalWithdrawn) },
]

type FilterChipKey = 'search' | 'state' | 'user' | 'tester' | 'anveshan'

interface FilterChip {
  key: FilterChipKey
  label: string
  /** True when the filter belongs to this page; header mode filters are changed from the header. */
  removable: boolean
}

const SCOPE_LABELS: Record<'only' | 'exclude', { tester: string; anveshan: string }> = {
  only: { tester: 'Testers only', anveshan: 'Anveshan users only' },
  exclude: { tester: 'Testers excluded', anveshan: 'Anveshan users excluded' },
}

// Chips for the filters the server reports it applied to the totals.
function buildFilterChips(filters: WalletScopeFilters, testerFromHeader: boolean): FilterChip[] {
  const chips: FilterChip[] = []
  if (filters.search) chips.push({ key: 'search', label: `Search: "${filters.search}"`, removable: true })
  if (filters.state) chips.push({ key: 'state', label: `State: ${filters.state}`, removable: false })
  if (filters.userId) chips.push({ key: 'user', label: `User: ${filters.userId}`, removable: false })
  if (filters.tester) {
    const label = SCOPE_LABELS[filters.tester].tester
    chips.push({ key: 'tester', label: testerFromHeader ? `Mode: ${label}` : label, removable: !testerFromHeader })
  }
  if (filters.anveshanScope) {
    chips.push({ key: 'anveshan', label: `Mode: ${SCOPE_LABELS[filters.anveshanScope].anveshan}`, removable: false })
  }
  return chips
}

interface AppliedFilterChipsProps {
  chips: FilterChip[]
  onRemove: (key: FilterChipKey) => void
  onClearAll: () => void
}

function AppliedFilterChips({ chips, onRemove, onClearAll }: AppliedFilterChipsProps) {
  if (chips.length === 0) return null
  const hasRemovable = chips.some((chip) => chip.removable)
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Applied filters">
      <span className="text-xs text-muted-foreground">Filtered by:</span>
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="gap-1 text-[11px] sm:text-xs"
          title={chip.removable ? undefined : 'Change this from the mode selector in the header'}
        >
          {chip.label}
          {chip.removable && (
            <button
              type="button"
              onClick={() => onRemove(chip.key)}
              className="rounded-full hover:text-foreground"
              aria-label={`Remove filter ${chip.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
      {hasRemovable && (
        <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearAll}>
          Clear filters
        </Button>
      )}
    </div>
  )
}

function StatValue({ value, className }: { value: number | undefined; className: string }) {
  if (value === undefined) {
    return <span className="mt-1 block h-8 w-28 rounded bg-muted animate-pulse" aria-label="Loading" />
  }
  return <p className={cn('mt-1 text-xl sm:text-2xl font-extrabold tabular-nums', className)}>₹{formatINRFull(value)}</p>
}

// ─── Main Wallets Page ───────────────────────────────────────────────────────

export function WalletsPage() {
  const [wallets, setWallets] = useState<WalletSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totals, setTotals] = useState<WalletTotals | null>(null)
  const latestTotalsRequest = useRef(0)
  const testerFromHeader = useTesterScope() !== 'all'
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [detailWallet, setDetailWallet] = useState<WalletSummary | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const limit = 30
  const [testerFilter, setTesterFilter] = useState<TesterFilterValue>('')

  const location = useLocation()
  const navigate = useNavigate()
  const [pendingOpenUserId, setPendingOpenUserId] = useState<string | null>(null)

  // Pick up openUserId passed from notification click
  useEffect(() => {
    const userId = (location.state as { openUserId?: string } | null)?.openUserId
    if (userId) {
      setPendingOpenUserId(userId)
      // Clear state so a refresh doesn't re-open
      window.history.replaceState({}, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Totals cover every wallet matching the filters, so they are fetched once per filter change, not per page.
  const fetchTotals = useCallback(async (search: string, tester: TesterFilterValue) => {
    const requestId = ++latestTotalsRequest.current
    setTotals(null)
    try {
      const res = await adminApi.getWalletsSummary({ search: search || undefined, tester: tester || undefined })
      if (requestId === latestTotalsRequest.current) setTotals(res)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load wallet totals'))
    }
  }, [])

  const fetchWallets = useCallback(async (pageNum = 1, search = searchQuery, tester = testerFilter) => {
    setLoading(true)
    if (pageNum === 1) void fetchTotals(search, tester)
    try {
      const params: Record<string, string | number> = { page: pageNum, limit }
      if (search) params.search = search
      if (tester) params.tester = tester
      const res = await adminApi.getWallets(params)
      setWallets(pageNum === 1 ? res.items : (prev) => [...prev, ...res.items])
      setTotal(res.total)
      setPage(pageNum)

      // Auto-open the wallet modal if a user was passed in from notifications
      if (pendingOpenUserId) {
        const target = res.items.find((w: WalletSummary) => w.userId === pendingOpenUserId)
        if (target) {
          setDetailWallet(target)
          setDetailOpen(true)
          setPendingOpenUserId(null)
        }
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load wallets'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [searchQuery, testerFilter, fetchTotals])

  useEffect(() => {
    fetchWallets(1, searchQuery)
  }, [])

  async function onRefresh() {
    setRefreshing(true)
    await fetchWallets(1, searchQuery)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(searchInput)
    setPage(1)
    setWallets([])
    fetchWallets(1, searchInput)
  }

  function openDetail(wallet: WalletSummary) {
    setDetailWallet(wallet)
    setDetailOpen(true)
  }

  function closeDetail() {
    setDetailOpen(false)
    // Refresh to pick up any balance changes
    fetchWallets(1, searchQuery)
    setDetailWallet(null)
  }

  function clearSearch() {
    setSearchInput('')
    setSearchQuery('')
    setPage(1)
    setWallets([])
    fetchWallets(1, '')
  }

  function changeTesterFilter(value: TesterFilterValue) {
    setTesterFilter(value)
    setPage(1)
    setWallets([])
    fetchWallets(1, searchQuery, value)
  }

  function clearPageFilters() {
    setSearchInput('')
    setSearchQuery('')
    setTesterFilter('')
    setPage(1)
    setWallets([])
    fetchWallets(1, '', '')
  }

  function removeFilter(key: FilterChipKey) {
    if (key === 'search') clearSearch()
    if (key === 'tester') changeTesterFilter('')
  }

  const filterChips = totals ? buildFilterChips(totals.appliedFilters, testerFromHeader) : []
  const scopeCaption = totals
    ? `Across ${totals.isFiltered ? '' : 'all '}${totals.totalWallets.toLocaleString('en-IN')}${totals.isFiltered ? ' filtered' : ''} wallet${totals.totalWallets === 1 ? '' : 's'}`
    : 'Across all wallets'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Wallet Management
          </h2>
          <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground mt-1">
            {total.toLocaleString('en-IN')} wallet{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            name="wallets"
            columns={WALLET_EXPORT_COLUMNS}
            disabled={total === 0}
            fetchPage={(page, limit) => adminApi.getWallets({ page, limit, search: searchQuery || undefined, tester: testerFilter || undefined })}
          />
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <AppliedFilterChips chips={filterChips} onRemove={removeFilter} onClearAll={clearPageFilters} />

      {/* Summary stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs sm:text-xs sm:text-sm text-text-secondary">Total Distributed</p>
                <StatValue value={totals?.totalDistributed} className="text-success" />
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary mt-1">{scopeCaption}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs sm:text-xs sm:text-sm text-text-secondary">Total Withdrawn</p>
                <StatValue value={totals?.totalWithdrawn} className="text-destructive" />
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary mt-1">Completed withdrawal payouts</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs sm:text-xs sm:text-sm text-text-secondary">Active Balance</p>
                <StatValue value={totals?.totalBalance} className="text-primary" />
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary mt-1">Available in wallets</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            placeholder="Search by name or mobile number…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-44 shrink-0">
          <TesterFilter
            value={testerFilter}
            onChange={changeTesterFilter}
          />
        </div>
        <Button type="submit" size="sm">Search</Button>
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSearch}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </form>

      {/* Wallets table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-xs sm:text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Category</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Balance</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total Earned</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Withdrawn</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && wallets.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : wallets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    {searchQuery ? 'No wallets match your search' : 'No wallets found'}
                  </td>
                </tr>
              ) : (
                wallets.map((wallet) => (
                  <tr key={wallet.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                          type="button"
                          className="font-medium text-primary hover:underline text-left"
                          onClick={() => navigate(`/users/${wallet.user.id}`)}
                        >
                          {wallet.user.name}
                        </button>
                      {wallet.user.isTester && <span className="ml-2 align-middle"><TesterTag /></span>}
                      <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">{wallet.user.mobileNumber} · {wallet.user.state}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[11px] sm:text-[11px] sm:text-xs">{wallet.user.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground tabular-nums">
                      ₹{formatINRFull(Number(wallet.balance))}
                    </td>
                    <td className="px-4 py-3 text-right text-success tabular-nums">
                      ₹{formatINRFull(Number(wallet.totalEarned))}
                    </td>
                    <td className="px-4 py-3 text-right text-destructive tabular-nums">
                      ₹{formatINRFull(Number(wallet.totalWithdrawn))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={cn(
                        'text-[11px] sm:text-[11px] sm:text-xs capitalize',
                        wallet.user.verificationStatus === 'verified' ? 'bg-success text-white' :
                        wallet.user.verificationStatus === 'pending' ? 'bg-warning text-white' :
                        wallet.user.verificationStatus === 'suspended' || wallet.user.verificationStatus === 'banned' ? 'bg-destructive text-white' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {wallet.user.verificationStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-primary hover:text-primary"
                        onClick={() => openDetail(wallet)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {total > limit && (
          <div className="flex items-center justify-center px-4 py-3 border-t bg-muted/30">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchWallets(page + 1, searchQuery)}
              disabled={loading}
            >
              {loading ? 'Loading…' : `Load More (${total - wallets.length} remaining)`}
            </Button>
          </div>
        )}
      </div>

      {/* Wallet detail modal — shared component */}
      {detailWallet && (
        <WalletDetailModal
          userId={detailWallet.userId}
          open={detailOpen}
          onClose={closeDetail}
          summary={detailWallet}
        />
      )}
    </div>
  )
}

export default WalletsPage