/**
 * Public Wallet Page — mirrors mobile/src/screens/Wallet/WalletScreen.tsx
 *
 * Shows the authenticated public user's wallet:
 *  • Available Balance hero card with min-withdrawal pill
 *  • 3-stat grid (Earned / Withdrawn / Pending)
 *  • "Earn ₹X more to unlock withdrawals" info banner
 *  • Transaction History with type/source/status filter pills
 *  • Transaction detail dialog
 *  • Empty state
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { walletApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  RefreshCw, CreditCard, Info, Filter as FilterIcon, X,
  ArrowDownRight, ArrowUpRight, Clock, Wallet as WalletIcon,
  Receipt, Loader2, Lock,
} from 'lucide-react'
import { cn, formatINRFull, formatINRCompact } from '@/lib/utils'
import { toast } from 'sonner'
import type { Transaction } from '@/types'

// ─── Filter types ────────────────────────────────────────────────────────────

type TxType = 'all' | 'credit' | 'debit'
type TxSource = 'all' | 'reward' | 'withdrawal' | 'refund' | 'adjustment'
type TxStatus = 'all' | 'pending' | 'completed' | 'failed' | 'reversed'

const TX_STATUS_COLORS: Record<string, string> = {
  pending:   'bg-warning text-white',
  completed: 'bg-success text-white',
  failed:    'bg-destructive text-white',
  reversed:  'bg-muted text-muted-foreground',
  rejected:  'bg-destructive text-white',
}

const TX_SOURCE_LABELS: Record<string, string> = {
  reward:     'Reward',
  withdrawal: 'Withdrawal',
  refund:     'Refund',
  adjustment: 'Adjustment',
}

const TX_TYPE_COLORS: Record<string, string> = {
  credit: 'text-success',
  debit:  'text-destructive',
}

function formatRel(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
    if (diffH < 1) return 'just now'
    if (diffH < 24) return `${diffH}h ago`
    const days = Math.floor(diffH / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  } catch {
    return '—'
  }
}

// ─── Filter pill ─────────────────────────────────────────────────────────────

interface FilterPillProps {
  label: string
  active: boolean
  onClick: () => void
}
function FilterPill({ label, active, onClick }: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-white'
          : 'border-border-subtle bg-surface text-text-secondary hover:border-emerald-300',
      )}
    >
      {label}
    </button>
  )
}

// ─── Transaction detail dialog ───────────────────────────────────────────────

interface TxDetailProps {
  tx: Transaction | null
  open: boolean
  onClose: () => void
}
function TxDetailDialog({ tx, open, onClose }: TxDetailProps) {
  if (!tx) return null
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transaction Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-md border border-border-subtle bg-muted/30 p-3 text-center">
            <p className="text-xs uppercase tracking-wider text-text-tertiary">Amount</p>
            <p className={cn('mt-1 text-2xl font-extrabold tabular-nums', TX_TYPE_COLORS[tx.type] ?? 'text-foreground')}>
              {tx.type === 'credit' ? '+' : '−'}₹{formatINRFull(Number(tx.amount))}
            </p>
            {tx.balanceAfter != null && (
              <p className="mt-1 text-[11px] tabular-nums text-text-tertiary">
                Balance after: ₹{formatINRFull(Number(tx.balanceAfter))}
              </p>
            )}
          </div>
          <Row label="Type" value={<span className="capitalize">{tx.type}</span>} />
          <Row label="Source" value={TX_SOURCE_LABELS[tx.source] ?? tx.source} />
          <Row label="Status" value={
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', TX_STATUS_COLORS[tx.status] ?? 'bg-muted text-muted-foreground')}>
              {tx.status}
            </span>
          } />
          {tx.description && <Row label="Description" value={tx.description} />}
          {tx.referenceId && <Row label="Reference" value={<span className="font-mono text-xs">{tx.referenceId}</span>} />}
          {tx.rejectionReason && <Row label="Rejection reason" value={<span className="text-destructive">{tx.rejectionReason}</span>} />}
          <Row label="Date" value={formatDateTime(tx.createdAt)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-sm">
      <span className="text-text-tertiary">{label}</span>
      <div className="col-span-2 font-medium text-foreground">{value}</div>
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'success' | 'primary' | 'warning' | 'muted'
}
function StatCard({ icon, label, value, tone }: StatCardProps) {
  const palettes: Record<typeof tone, { bg: string; text: string; value: string }> = {
    success: { bg: 'bg-success/10 border-success/20', text: 'text-success', value: 'text-success' },
    primary: { bg: 'bg-primary/10 border-primary/20',  text: 'text-primary',  value: 'text-primary' },
    warning: { bg: 'bg-warning/10 border-warning/25',  text: 'text-warning',  value: 'text-warning' },
    muted:   { bg: 'bg-muted border-border-subtle',    text: 'text-text-tertiary', value: 'text-foreground' },
  }
  const p = palettes[tone]
  return (
    <div className={cn('rounded-xl border p-3', p.bg)}>
      <div className={cn('flex h-7 w-7 items-center justify-center rounded-md bg-white/70 dark:bg-black/20', p.text)}>
        {icon}
      </div>
      <p className={cn('mt-2 text-lg font-extrabold tabular-nums leading-none', p.value)}>{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</p>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function PublicWalletPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [minWithdrawal, setMinWithdrawal] = useState<number>(50)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const limit = 30

  // Filters
  const [filterType, setFilterType] = useState<TxType>('all')
  const [filterSource, setFilterSource] = useState<TxSource>('all')
  const [filterStatus, setFilterStatus] = useState<TxStatus>('all')
  const [showFilters, setShowFilters] = useState(false)

  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [balRes, cfgRes, txRes] = await Promise.allSettled([
        walletApi.getBalance(),
        walletApi.getWalletConfig(),
        walletApi.getTransactions({ page: 1, limit }),
      ])
      if (balRes.status === 'fulfilled') setBalance(Number(balRes.value.balance ?? 0))
      if (cfgRes.status === 'fulfilled') setMinWithdrawal(Number(cfgRes.value.minWithdrawalAmount ?? 50))
      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value.items ?? [])
        setTotal(txRes.value.total ?? 0)
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load wallet data.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function onRefresh() {
    setRefreshing(true)
    try {
      const [balRes, txRes] = await Promise.allSettled([
        walletApi.getBalance(),
        walletApi.getTransactions({ page: 1, limit }),
      ])
      if (balRes.status === 'fulfilled') setBalance(Number(balRes.value.balance ?? 0))
      if (txRes.status === 'fulfilled') {
        setTransactions(txRes.value.items ?? [])
        setTotal(txRes.value.total ?? 0)
      }
    } finally {
      setRefreshing(false)
    }
  }

  // ── Filtered list ──────────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== 'all' && tx.type !== filterType) return false
      if (filterSource !== 'all' && tx.source !== filterSource) return false
      if (filterStatus !== 'all' && tx.status !== filterStatus) return false
      return true
    })
  }, [transactions, filterType, filterSource, filterStatus])

  const hasActiveFilters = filterType !== 'all' || filterSource !== 'all' || filterStatus !== 'all'

  function clearFilters() {
    setFilterType('all')
    setFilterSource('all')
    setFilterStatus('all')
  }

  // ── Quick stats ────────────────────────────────────────────────────────
  // Calculated from the loaded transaction page (latest 30). The mobile app
  // loads all pages so its totals are exhaustive; on the web we keep the
  // same shape (totals over the visible window) to avoid an unbounded fetch.
  const totalEarned = useMemo(() =>
    transactions
      .filter((tx) => tx.type === 'credit' && tx.status === 'completed' && tx.source === 'reward')
      .reduce((sum, tx) => sum + Number(tx.amount), 0),
    [transactions])
  const totalWithdrawn = useMemo(() =>
    transactions
      .filter((tx) => tx.source === 'withdrawal' && tx.status === 'completed')
      .reduce((sum, tx) => sum + Number(tx.amount), 0),
    [transactions])
  const pendingCount = useMemo(() =>
    transactions.filter((tx) => tx.status === 'pending').length,
    [transactions])

  const belowMin = (balance ?? 0) < minWithdrawal
  const remainingToMin = Math.max(0, minWithdrawal - (balance ?? 0))

  if (loading && balance === null) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-2xl space-y-5">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">Wallet</h2>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Link
              to="/public/payment-methods"
              className="flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:bg-emerald-400/15 dark:text-emerald-300"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Payment Methods
            </Link>
          </div>
        </div>

        {/* ── Balance hero card ──────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-5 text-white shadow-md dark:from-emerald-700 dark:via-emerald-800 dark:to-teal-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-90">
                <WalletIcon className="h-3.5 w-3.5" />
                Available Balance
              </div>
              <p className="mt-2 text-4xl font-extrabold tabular-nums leading-tight sm:text-5xl">
                ₹{formatINRFull(balance ?? 0)}
              </p>
              <p className="mt-1 text-xs opacity-80">Indian Rupees</p>
            </div>
            <div className="shrink-0">
              {belowMin ? (
                <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                  <Info className="h-3.5 w-3.5 opacity-90" />
                  Min ₹{minWithdrawal.toLocaleString('en-IN')} to withdraw
                </div>
              ) : (
                <Link
                  to="/public/withdraw"
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur transition-colors hover:bg-white/25"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Withdraw
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ── Quick stats grid ───────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<ArrowDownRight className="h-4 w-4" />}
            label="Earned"
            value={formatINRCompact(totalEarned)}
            tone="success"
          />
          <StatCard
            icon={<ArrowUpRight className="h-4 w-4" />}
            label="Withdrawn"
            value={formatINRCompact(totalWithdrawn)}
            tone="primary"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Pending"
            value={formatINRCompact(pendingCount)}
            tone={pendingCount > 0 ? 'warning' : 'muted'}
          />
        </div>

        {/* ── Withdraw info banner (when balance < min) ──────────── */}
        {belowMin && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-text-secondary dark:border-amber-900/50 dark:bg-amber-950/20">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              Earn{' '}
              <span className="font-bold text-amber-700 dark:text-amber-400">
                ₹{remainingToMin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>{' '}
              more to unlock withdrawals
            </p>
          </div>
        )}

        {/* ── Transaction history ────────────────────────────────── */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                Transaction History
                {hasActiveFilters && (
                  <span className="ml-1 text-sm font-semibold text-primary">
                    ({filteredTransactions.length})
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1.5">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Clear
                  </button>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-emerald-50 hover:text-emerald-700"
                      aria-label="About transactions"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Reward credits appear after question approvals. Withdrawals
                    move balance to your saved payment method.
                  </TooltipContent>
                </Tooltip>
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className={cn(
                    'relative flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                    showFilters || hasActiveFilters
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40'
                      : 'text-text-tertiary hover:bg-emerald-50 hover:text-emerald-700',
                  )}
                  aria-label="Toggle filters"
                >
                  <FilterIcon className="h-4 w-4" />
                  {hasActiveFilters && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="space-y-2 rounded-md border border-border-subtle bg-surface p-3 dark:bg-surface-variant/40">
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Type</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'credit', 'debit'] as TxType[]).map((f) => (
                      <FilterPill
                        key={f}
                        label={f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                        active={filterType === f}
                        onClick={() => setFilterType(f)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Source</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'reward', 'withdrawal', 'refund'] as TxSource[]).map((f) => (
                      <FilterPill
                        key={f}
                        label={f === 'all' ? 'All' : (TX_SOURCE_LABELS[f] ?? f).replace(/_/g, ' ')}
                        active={filterSource === f}
                        onClick={() => setFilterSource(f)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'completed', 'pending', 'failed', 'reversed'] as TxStatus[]).map((f) => (
                      <FilterPill
                        key={f}
                        label={f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                        active={filterStatus === f}
                        onClick={() => setFilterStatus(f)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Transactions list / empty state */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="py-10 text-center">
                <Receipt className="mx-auto h-12 w-12 text-text-tertiary/60" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-bold text-foreground">No transactions yet</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {hasActiveFilters
                    ? 'No transactions match the selected filters.'
                    : 'Your reward credits will appear here after question approvals'}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">
                    <X className="h-3.5 w-3.5" /> Clear filters
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {filteredTransactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="cursor-pointer p-3 transition-colors hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10"
                    onClick={() => setSelectedTx(tx)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        tx.type === 'credit' ? 'bg-success/12 text-success' : 'bg-destructive/12 text-destructive',
                      )}>
                        {tx.type === 'credit'
                          ? <ArrowDownRight className="h-4 w-4" />
                          : <ArrowUpRight className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {TX_SOURCE_LABELS[tx.source] ?? tx.source}
                              {tx.status === 'pending' && (
                                <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-warning">Pending</span>
                              )}
                              {tx.status === 'failed' && (
                                <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-destructive">Failed</span>
                              )}
                              {tx.status === 'reversed' && (
                                <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">Reversed</span>
                              )}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-text-secondary">
                              {tx.description ?? formatRel(tx.createdAt)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={cn('text-sm font-extrabold tabular-nums', TX_TYPE_COLORS[tx.type] ?? 'text-foreground')}>
                              {tx.type === 'credit' ? '+' : '−'}₹{formatINRFull(Number(tx.amount))}
                            </p>
                            <p className="mt-0.5 text-[10px] text-text-tertiary">{formatRel(tx.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Load more */}
            {!loading && total > transactions.length && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const nextPage = Math.floor(transactions.length / limit) + 1
                    try {
                      const res = await walletApi.getTransactions({ page: nextPage, limit })
                      setTransactions((prev) => [...prev, ...(res.items ?? [])])
                    } catch (err) {
                      toast.error(getErrorMessage(err, 'Failed to load more.'))
                    }
                  }}
                >
                  Load more ({total - transactions.length} remaining)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-text-tertiary">AnnaDatha · Made for Indian farmers</p>
      </div>

      <TxDetailDialog tx={selectedTx} open={selectedTx !== null} onClose={() => setSelectedTx(null)} />
    </TooltipProvider>
  )
}

export default PublicWalletPage

