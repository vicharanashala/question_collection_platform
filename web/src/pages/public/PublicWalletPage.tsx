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
import { useTranslation } from 'react-i18next'
import { walletApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  RefreshCw, CreditCard, Info, Filter as FilterIcon, X,
  ArrowDownRight, ArrowUpRight, Clock, Wallet as WalletIcon,
  Receipt, Loader2, Lock, AtSign, Building2, CheckCircle2,
} from 'lucide-react'
import { cn, formatINRFull, formatINRCompact } from '@/lib/utils'
import { toast } from 'sonner'
import i18n from '@/i18n'
import type { Transaction, PaymentDetail } from '@/types'

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
    if (diffH < 1) return i18n.t('common.justNow')
    if (diffH < 24) return i18n.t('common.hoursAgo', { count: diffH })
    const days = Math.floor(diffH / 24)
    if (days < 7) return i18n.t('common.daysAgo', { count: days })
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
        'shrink-0 rounded-full border px-3 py-1 text-[11px] sm:text-[11px] sm:text-xs font-semibold transition-colors',
        active
          ? 'border-primary bg-primary text-white'
          : 'border-border-subtle bg-surface text-text-secondary hover:border-emerald-300 dark:hover:border-emerald-700',
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
  const { t } = useTranslation()
  if (!tx) return null
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('wallet.txDetail')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-md border border-border-subtle bg-muted/30 p-3 text-center">
            <p className="text-[11px] sm:text-[11px] sm:text-xs uppercase tracking-wider text-text-tertiary">Amount</p>
            <p className={cn('mt-1 text-xl sm:text-2xl font-extrabold tabular-nums', TX_TYPE_COLORS[tx.type] ?? 'text-foreground')}>
              {tx.type === 'credit' ? '+' : '−'}₹{formatINRFull(Number(tx.amount))}
            </p>
            {tx.balanceAfter != null && (
              <p className="mt-1 text-[11px] tabular-nums text-text-tertiary">
                {t('wallet.txBalanceAfter')}: ₹{formatINRFull(Number(tx.balanceAfter))}
              </p>
            )}
          </div>
          <Row label={t('wallet.txType')} value={<span className="capitalize">{tx.type === 'credit' ? t('wallet.credit') : t('wallet.debit')}</span>} />
          <Row label={t('wallet.txSource')} value={TX_SOURCE_LABELS[tx.source] ?? tx.source} />
          <Row label="Status" value={
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', TX_STATUS_COLORS[tx.status] ?? 'bg-muted text-muted-foreground')}>
              {tx.status}
            </span>
          } />
          {tx.description && <Row label={t('wallet.txDescription')} value={tx.description} />}
          {tx.referenceId && <Row label="Reference" value={<span className="font-mono text-[11px] sm:text-[11px] sm:text-xs">{tx.referenceId}</span>} />}
          {tx.rejectionReason && <Row label={t('wallet.rejectionReason')} value={<span className="text-destructive">{tx.rejectionReason}</span>} />}
          <Row label={t('wallet.txDate')} value={formatDateTime(tx.createdAt)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-xs sm:text-xs sm:text-sm">
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
    <div className={cn('rounded-xl border p-3 lg:p-4', p.bg)}>
      <div className={cn('flex h-7 w-7 items-center justify-center rounded-md bg-white/70 dark:bg-black/20 lg:h-9 lg:w-9', p.text)}>
        {icon}
      </div>
      <p className={cn('mt-2 text-base sm:text-lg font-extrabold tabular-nums leading-none lg:text-lg sm:text-xl', p.value)}>{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-text-tertiary lg:text-[11px] sm:text-xs">{label}</p>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function PublicWalletPage() {
  const { t } = useTranslation()
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
        setTransactions(txRes.value.transactions ?? [])
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
        setTransactions(txRes.value.transactions ?? [])
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

  // ── Withdraw modal — mirrors mobile's WalletScreen confirm-withdraw sheet ──
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([])
  const [selectedPaymentDetailId, setSelectedPaymentDetailId] = useState<string | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [payoutError, setPayoutError] = useState('')

  const parsedAmount = parseFloat(withdrawAmount)
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= minWithdrawal && parsedAmount <= (balance ?? 0)
  const verifiedPaymentDetails = useMemo(
    () => paymentDetails.filter((d) => d.status === 'verified'),
    [paymentDetails],
  )

  function resetWithdrawForm() {
    setWithdrawAmount('')
    setPayoutError('')
    setSelectedPaymentDetailId(null)
    setPaymentDetails([])
  }

  async function loadPaymentDetails() {
    setLoadingDetails(true)
    try {
      const items = await walletApi.getPaymentDetails()
      setPaymentDetails(items)
      const verified = items.find((d) => d.status === 'verified')
      setSelectedPaymentDetailId(verified?.id ?? null)
    } catch {
      toast.error(t('wallet.loadPaymentDetailsError'))
    } finally {
      setLoadingDetails(false)
    }
  }

  function openWithdraw() {
    if (belowMin) {
      toast.error(t('wallet.minWithdrawalError', { amount: minWithdrawal }))
      return
    }
    resetWithdrawForm()
    setWithdrawOpen(true)
    loadPaymentDetails()
  }

  async function handleWithdraw() {
    const selected = paymentDetails.find((d) => d.id === selectedPaymentDetailId)
    if (!selected) {
      setPayoutError(t('wallet.paymentMethodRequired'))
      return
    }
    if (selected.status !== 'verified') {
      setPayoutError(t('wallet.paymentMethodNotVerified'))
      return
    }
    setWithdrawing(true)
    try {
      await walletApi.withdraw({ amount: parsedAmount, paymentDetailId: selected.id })
      toast.success(t('wallet.success'))
      setWithdrawOpen(false)
      resetWithdrawForm()
      fetchData()
    } catch (err) {
      setPayoutError(getErrorMessage(err, t('wallet.failed')))
    } finally {
      setWithdrawing(false)
    }
  }

  if (loading && balance === null) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-5xl space-y-5">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-lg sm:text-xl font-bold text-foreground">{t('wallet.title')}</h2>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 disabled:opacity-50"
                  aria-label="Refresh"
                >
                  <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
            <Link
              to="/home/payment-methods"
              className="flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 py-1.5 text-[11px] sm:text-[11px] sm:text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:bg-emerald-400/15 dark:text-emerald-300"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {t('profile.paymentMethods')}
            </Link>
          </div>
        </div>

        {/* ── Balance hero card ──────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 p-5 text-white shadow-md dark:from-emerald-700 dark:via-emerald-800 dark:to-teal-900 lg:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-[11px] sm:text-xs font-semibold uppercase tracking-wider opacity-90">
                <WalletIcon className="h-3.5 w-3.5" />
                {t('wallet.availableBalance')}
              </div>
              <p className="mt-2 text-4xl font-extrabold tabular-nums leading-tight sm:text-5xl">
                ₹{formatINRFull(balance ?? 0)}
              </p>
              <p className="mt-1 text-[11px] sm:text-[11px] sm:text-xs opacity-80">Indian Rupees</p>
            </div>
            <div className="shrink-0">
              {belowMin ? (
                <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] sm:text-[11px] sm:text-xs font-semibold backdrop-blur">
                  <Info className="h-3.5 w-3.5 opacity-90" />
                  {t('wallet.minToWithdraw', { amount: minWithdrawal.toLocaleString('en-IN') })}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openWithdraw}
                  className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] sm:text-[11px] sm:text-xs font-semibold backdrop-blur transition-colors hover:bg-white/25"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {t('wallet.withdraw')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Quick stats grid ───────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<ArrowDownRight className="h-4 w-4" />}
            label={t('wallet.earned')}
            value={formatINRCompact(totalEarned)}
            tone="success"
          />
          <StatCard
            icon={<ArrowUpRight className="h-4 w-4" />}
            label={t('wallet.withdrawn')}
            value={formatINRCompact(totalWithdrawn)}
            tone="primary"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label={t('status.pending')}
            value={formatINRCompact(pendingCount)}
            tone={pendingCount > 0 ? 'warning' : 'muted'}
          />
        </div>

        {/* ── Withdraw info banner (when balance < min) ──────────── */}
        {belowMin && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs sm:text-xs sm:text-sm text-text-secondary dark:border-amber-900/50 dark:bg-amber-950/20">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p>
              {t('wallet.earnMoreToUnlock', {
                amount: remainingToMin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              })}
            </p>
          </div>
        )}

        {/* ── Transaction history ────────────────────────────────── */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-sm sm:text-base font-bold text-foreground">
                {t('wallet.transactionHistory')}
                {hasActiveFilters && (
                  <span className="ml-1 text-xs sm:text-xs sm:text-sm font-semibold text-primary">
                    ({filteredTransactions.length})
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1.5">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[11px] sm:text-[11px] sm:text-xs font-semibold text-primary hover:underline"
                  >
                    {t('wallet.clearFilters')}
                  </button>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                      aria-label="About transactions"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {t('wallet.txTooltip')}
                  </TooltipContent>
                </Tooltip>
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  className={cn(
                    'relative flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                    showFilters || hasActiveFilters
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'text-text-tertiary hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300',
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
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{t('wallet.filterByType')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'credit', 'debit'] as TxType[]).map((f) => (
                      <FilterPill
                        key={f}
                        label={f === 'all' ? t('wallet.filterAll') : f === 'credit' ? t('wallet.credit') : t('wallet.debit')}
                        active={filterType === f}
                        onClick={() => setFilterType(f)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{t('wallet.filterBySource')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'reward', 'withdrawal', 'refund'] as TxSource[]).map((f) => (
                      <FilterPill
                        key={f}
                        label={f === 'all' ? t('wallet.filterAll') : (TX_SOURCE_LABELS[f] ?? f).replace(/_/g, ' ')}
                        active={filterSource === f}
                        onClick={() => setFilterSource(f)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 mt-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{t('wallet.filterByStatus')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['all', 'completed', 'pending', 'failed', 'reversed'] as TxStatus[]).map((f) => (
                      <FilterPill
                        key={f}
                        label={f === 'all' ? t('wallet.filterAll') : f.charAt(0).toUpperCase() + f.slice(1)}
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
                <p className="mt-3 text-xs sm:text-xs sm:text-sm font-bold text-foreground">
                  {hasActiveFilters ? t('wallet.noMatchingTransactions') : t('wallet.noTransactions')}
                </p>
                <p className="mt-1 text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">
                  {hasActiveFilters
                    ? t('wallet.noMatchingTransactionsDesc')
                    : t('wallet.noTransactionsDesc')}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">
                    <X className="h-3.5 w-3.5" /> {t('wallet.clearFilters')}
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
                            <p className="truncate text-xs sm:text-xs sm:text-sm font-semibold text-foreground">
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
                            <p className="mt-0.5 truncate text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">
                              {tx.description ?? formatRel(tx.createdAt)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={cn('text-xs sm:text-xs sm:text-sm font-extrabold tabular-nums', TX_TYPE_COLORS[tx.type] ?? 'text-foreground')}>
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
                      setTransactions((prev) => [...prev, ...(res.transactions ?? [])])
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

        <p className="text-center text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">AnnaDatha · Made for Indian farmers</p>
      </div>

      <TxDetailDialog tx={selectedTx} open={selectedTx !== null} onClose={() => setSelectedTx(null)} />

      {/* ── Withdraw confirmation dialog ─────────────────────────── */}
      <Dialog open={withdrawOpen} onOpenChange={(v) => !v && !withdrawing && setWithdrawOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-6 w-6" />
            </div>
            <DialogTitle className="mt-2">{t('wallet.confirmWithdrawTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                {t('wallet.availableBalance')}
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-extrabold tabular-nums text-foreground">
                ₹{formatINRFull(balance ?? 0)}
              </p>
            </div>

            <div>
              <div className="flex h-12 items-center gap-1.5 rounded-md border border-border-subtle bg-background px-3">
                <span className="text-base sm:text-base sm:text-lg font-bold text-text-secondary">₹</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder={String(minWithdrawal)}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  maxLength={8}
                  autoFocus
                  className="h-full border-0 p-0 text-base sm:text-base sm:text-lg font-bold shadow-none focus-visible:ring-0"
                />
              </div>
              {!isValidAmount && withdrawAmount.length > 0 && (
                <p className="mt-1.5 text-[11px] sm:text-[11px] sm:text-xs font-medium text-destructive">
                  {!isNaN(parsedAmount) && parsedAmount > (balance ?? 0)
                    ? t('wallet.exceedBalance')
                    : t('wallet.minWithdrawalError', { amount: minWithdrawal.toLocaleString('en-IN') })}
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                {t('wallet.payoutMethod')}
              </p>

              {loadingDetails ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                </div>
              ) : paymentDetails.length === 0 ? (
                <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-center">
                  <p className="text-xs sm:text-xs sm:text-sm font-bold text-warning">{t('paymentMethods.emptyTitle')}</p>
                  <Link
                    to="/home/payment-methods"
                    className="mt-1 inline-block text-[11px] sm:text-[11px] sm:text-xs font-semibold text-emerald-700 underline dark:text-emerald-400"
                    onClick={() => setWithdrawOpen(false)}
                  >
                    {t('profile.paymentMethods')}
                  </Link>
                </div>
              ) : verifiedPaymentDetails.length === 0 ? (
                <p className="py-3 text-center text-[11px] sm:text-[11px] sm:text-xs italic text-text-tertiary">
                  {t('wallet.paymentMethodNotVerified')}
                </p>
              ) : (
                <div className="space-y-2">
                  {verifiedPaymentDetails.map((detail) => (
                    <button
                      key={detail.id}
                      type="button"
                      onClick={() => { setSelectedPaymentDetailId(detail.id); setPayoutError('') }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md border p-3 text-left transition-colors',
                        selectedPaymentDetailId === detail.id
                          ? 'border-primary bg-primary/8'
                          : 'border-border-subtle hover:border-emerald-300 dark:hover:border-emerald-700',
                      )}
                    >
                      {detail.payoutMethod === 'upi'
                        ? <AtSign className={cn('h-4 w-4 shrink-0', selectedPaymentDetailId === detail.id ? 'text-primary' : 'text-text-secondary')} />
                        : <Building2 className={cn('h-4 w-4 shrink-0', selectedPaymentDetailId === detail.id ? 'text-primary' : 'text-text-secondary')} />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs sm:text-xs sm:text-sm font-bold text-foreground">
                          {detail.payoutMethod === 'upi' ? detail.displayValue : `A/c ${detail.displayValue}`}
                        </p>
                        {detail.payoutMethod === 'bank_transfer' && detail.bankName && (
                          <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">{detail.bankName}</p>
                        )}
                      </div>
                      {selectedPaymentDetailId === detail.id && (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {payoutError && (
              <p className="text-[11px] sm:text-[11px] sm:text-xs font-medium text-destructive">{payoutError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="flex-1"
              disabled={withdrawing}
              onClick={() => setWithdrawOpen(false)}
            >
              {t('wallet.cancel')}
            </Button>
            <Button
              className="flex-1"
              disabled={!isValidAmount || !selectedPaymentDetailId || withdrawing}
              onClick={handleWithdraw}
            >
              {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : t('wallet.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

export default PublicWalletPage

