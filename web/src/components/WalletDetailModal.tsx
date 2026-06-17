/**
 * WalletDetailModal — shared between WalletsPage and WithdrawalsPage.
 * Shows user info, balance, earned/withdrawn totals, and full transaction +
 * withdrawal history tabs. Super admins can also manually adjust balance.
 */
import { useState, useEffect, useCallback } from 'react'
import { adminApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDate } from '@/lib/utils'
import {
  Wallet, ArrowUpRight, ArrowDownRight, CheckCircle,
  RefreshCw, TrendingUp, TrendingDown, Clock, Hash,
} from 'lucide-react'
import { toast } from 'sonner'
import type { WalletSummary, Transaction, Withdrawal } from '@/types'

const TX_STATUS_COLORS: Record<string, string> = {
  pending:   'bg-warning text-white',
  completed: 'bg-success text-white',
  failed:    'bg-destructive text-white',
  reversed:  'bg-muted text-muted-foreground',
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

const WD_STATUS_COLORS: Record<string, string> = {
  pending:    'bg-warning text-white',
  processing: 'bg-ai_review text-white',
  completed:  'bg-success text-white',
  failed:     'bg-destructive text-white',
  cancelled:  'bg-muted text-muted-foreground',
}

const VERIFICATION_COLORS: Record<string, string> = {
  verified:    'bg-success text-white',
  pending:     'bg-warning text-white',
  unverified:  'bg-muted text-muted-foreground',
  suspended:   'bg-destructive text-white',
  banned:      'bg-destructive text-white',
}

interface WalletDetailModalProps {
  walletId: string
  userId: string
  open: boolean
  onClose: () => void
  /** Pre-load a wallet summary so the header shows immediately while data loads */
  summary?: Pick<WalletSummary, 'id' | 'userId' | 'balance' | 'totalEarned' | 'totalWithdrawn' | 'user'>
}

export function WalletDetailModal({ walletId, userId, open, onClose, summary }: WalletDetailModalProps) {
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [txTab, setTxTab] = useState<'transactions' | 'withdrawals'>('transactions')
  const [txPage, setTxPage] = useState(1)
  const [wdPage, setWdPage] = useState(1)
  const [loadingTx, setLoadingTx] = useState(false)
  const [loadingWd, setLoadingWd] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [wdTotal, setWdTotal] = useState(0)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustedBalance, setAdjustedBalance] = useState<number | null>(null)
  const [adjustError, setAdjustError] = useState('')

  const limit = 50

  const fetchTransactions = useCallback(async (page = 1) => {
    setLoadingTx(true)
    try {
      const res = await adminApi.getUserTransactions(userId, { page, limit })
      setTransactions(page === 1 ? res.items : (prev) => [...prev, ...res.items])
      setTxPage(page)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load transactions'))
    } finally {
      setLoadingTx(false)
    }
  }, [userId])

  const fetchWithdrawals = useCallback(async (page = 1) => {
    setLoadingWd(true)
    try {
      const res = await adminApi.getUserWithdrawals(userId, { page, limit })
      setWithdrawals(page === 1 ? res.items : (prev) => [...prev, ...res.items])
      setWdTotal(res.total)
      setWdPage(page)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load withdrawals'))
    } finally {
      setLoadingWd(false)
    }
  }, [userId])

  useEffect(() => {
    if (open) {
      setTxTab('transactions')
      setTxPage(1)
      setWdPage(1)
      setTransactions([])
      setWithdrawals([])
      setWdTotal(0)
      setAdjustedBalance(null)
      setAdjustError('')
      setAdjustOpen(false)
      setAdjustAmount('')
      setAdjustReason('')
      fetchTransactions(1)
      fetchWithdrawals(1)
    }
  }, [open, userId, fetchTransactions, fetchWithdrawals])

  async function handleAdjust() {
    if (!adjustAmount || !adjustReason.trim()) {
      setAdjustError('Both amount and reason are required')
      return
    }
    const amount = parseFloat(adjustAmount)
    if (isNaN(amount) || amount === 0) {
      setAdjustError('Enter a non-zero amount (positive = credit, negative = debit)')
      return
    }
    setAdjusting(true)
    setAdjustError('')
    try {
      const res = await adminApi.adjustWallet(userId, { amount, reason: adjustReason.trim() })
      setAdjustedBalance(res.newBalance)
      toast.success('Wallet adjusted successfully')
      setAdjustOpen(false)
      setAdjustAmount('')
      setAdjustReason('')
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to adjust wallet'))
    } finally {
      setAdjusting(false)
    }
  }

  const balance = adjustedBalance ?? summary?.balance ?? 0
  const totalEarned = summary?.totalEarned ?? 0
  const totalWithdrawn = summary?.totalWithdrawn ?? 0
  const user = summary?.user
  const totalTxCount = transactions.length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col items-center justify-center p-0 gap-0">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <DialogHeader className="w-full px-6 pt-6 pb-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Wallet className="h-5 w-5 text-primary" />
              Wallet Details
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* ── Body: 2-column layout ─────────────────────────────────── */}
        <div className="flex w-full min-h-0 flex-1">

          {/* ── Left panel: user + balance summary ─────────────────── */}
          <div className="w-72 shrink-0 border-r border-border-subtle overflow-y-auto p-5 space-y-5">

            {/* User card */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold uppercase shrink-0">
                  {user?.name ? user.name.charAt(0) : '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-text truncate">{user?.name ?? '—'}</p>
                  <p className="text-sm text-text-secondary">{user?.mobileNumber ?? '—'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {user?.category && <Badge variant="secondary" className="text-xs">{user.category}</Badge>}
                {user?.role && <Badge variant="secondary" className="text-xs capitalize">{user.role}</Badge>}
                {user?.verificationStatus && (
                  <Badge className={cn('text-xs capitalize', VERIFICATION_COLORS[user.verificationStatus] ?? 'bg-muted')}>
                    {user.verificationStatus}
                  </Badge>
                )}
              </div>

              {user?.state && (
                <p className="text-xs text-text-tertiary">
                  {user.state}{user?.district ? ` · ${user.district}` : ''}
                </p>
              )}
              {user?.createdAt && (
                <p className="text-xs text-text-tertiary">
                  Joined {formatDate(user.createdAt) ?? new Date(user.createdAt).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>

            {/* Balance card */}
            <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
              <p className="text-xs text-text-secondary uppercase tracking-wider">Current Balance</p>
              <p className="text-4xl font-extrabold text-primary tabular-nums leading-none">
                ₹{Number(balance).toLocaleString('en-IN')}
              </p>
              <div className="space-y-1.5 pt-2 border-t border-border-subtle">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-text-secondary">
                    <TrendingUp className="h-3 w-3 text-success" /> Total Earned
                  </span>
                  <span className="font-semibold text-success tabular-nums">
                    ₹{Number(totalEarned).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-text-secondary">
                    <TrendingDown className="h-3 w-3 text-destructive" /> Total Withdrawn
                  </span>
                  <span className="font-semibold text-destructive tabular-nums">
                    ₹{Number(totalWithdrawn).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <p className="text-xs text-text-secondary mb-1">Transactions</p>
                <p className="text-2xl font-bold text-text">{totalTxCount}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <p className="text-xs text-text-secondary mb-1">Withdrawals</p>
                <p className="text-2xl font-bold text-text">{wdTotal}</p>
              </div>
            </div>

            {/* Adjust button */}
            {isSuperAdmin && (
              <Button
                variant="outline"
                onClick={() => setAdjustOpen(true)}
                className="w-full justify-start text-sm"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Adjust Balance
              </Button>
            )}
          </div>

          {/* ── Right panel: transaction / withdrawal history ───────── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-5">
            <Tabs
              value={txTab}
              onValueChange={(v) => setTxTab(v as 'transactions' | 'withdrawals')}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-2 shrink-0">
                <TabsTrigger value="transactions" className="gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Transactions
                  {transactions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{transactions.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="withdrawals" className="gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  Withdrawals
                  {wdTotal > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">{wdTotal}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* ── Transactions table ────────────────────────────── */}
              <TabsContent value="transactions" className="flex flex-col flex-1 min-h-0 mt-3">
                <div className="rounded-lg border border-border overflow-hidden flex flex-col flex-1 min-h-0 h-full">
                  {/* Table header */}
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 bg-muted/60 text-xs font-semibold text-text-secondary uppercase tracking-wider shrink-0">
                    <span className="w-8 text-center">#</span>
                    <span>Details</span>
                    <span>Type</span>
                    <span className="text-right">Amount</span>
                    <span>Status</span>
                  </div>
                  {/* Table body */}
                  <div className="overflow-y-auto flex-1">
                    {loadingTx && transactions.length === 0 ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-t border-border-subtle items-center">
                          <Skeleton className="h-3 w-4" />
                          <Skeleton className="h-3 w-full max-w-32" />
                          <Skeleton className="h-3 w-16" />
                          <Skeleton className="h-3 w-16 ml-auto" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                      ))
                    ) : transactions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                        <Clock className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm font-medium">No transactions yet</p>
                      </div>
                    ) : (
                      transactions.map((tx, idx) => (
                        <div
                          key={tx.id}
                          className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-t border-border-subtle items-center hover:bg-surface-variant/40 transition-colors"
                        >
                          <span className="text-xs text-text-tertiary w-8 text-center tabular-nums">
                            {(txPage - 1) * limit + idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text truncate">
                              {TX_SOURCE_LABELS[tx.source] ?? tx.source}
                            </p>
                            <p className="text-xs text-text-secondary truncate">{tx.description ?? '—'}</p>
                            <p className="text-xs text-text-tertiary mt-0.5">
                              {formatDate(tx.createdAt) ?? new Date(tx.createdAt).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                          <div className={cn('flex items-center gap-1 text-xs font-semibold', TX_TYPE_COLORS[tx.type] ?? 'text-text')}>
                            {tx.type === 'credit'
                              ? <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                              : <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                            }
                            <span className="capitalize">{tx.type}</span>
                          </div>
                          <p className={cn('text-sm font-bold tabular-nums text-right', TX_TYPE_COLORS[tx.type] ?? 'text-text')}>
                            {tx.type === 'credit' ? '+' : '−'}₹{Number(tx.amount).toLocaleString('en-IN')}
                          </p>
                          <span className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize shrink-0',
                            TX_STATUS_COLORS[tx.status] ?? 'bg-muted',
                          )}>
                            {tx.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {loadingTx && transactions.length > 0 && (
                  <div className="flex justify-center py-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-text-tertiary" />
                  </div>
                )}
                <div className="flex justify-end mt-2 shrink-0">
                  <Button
                    variant="outline" size="sm" className="text-xs"
                    onClick={() => fetchTransactions(txPage + 1)}
                    disabled={loadingTx}
                  >
                    {loadingTx ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                    Load More
                  </Button>
                </div>
              </TabsContent>

              {/* ── Withdrawals table ─────────────────────────────── */}
              <TabsContent value="withdrawals" className="flex flex-col flex-1 min-h-0 mt-3">
                <div className="rounded-lg border border-border overflow-hidden flex flex-col flex-1 min-h-0 h-full">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 bg-muted/60 text-xs font-semibold text-text-secondary uppercase tracking-wider shrink-0">
                    <span>Request</span>
                    <span>Payout</span>
                    <span className="text-right">Amount</span>
                    <span>Status</span>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {loadingWd && withdrawals.length === 0 ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-t border-border-subtle items-center">
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-16 ml-auto" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                      ))
                    ) : withdrawals.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
                        <Hash className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm font-medium">No withdrawals yet</p>
                      </div>
                    ) : (
                      withdrawals.map((wd) => (
                        <div
                          key={wd.id}
                          className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-t border-border-subtle items-center hover:bg-surface-variant/40 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-mono text-text-tertiary truncate">{wd.id}</p>
                            <p className="text-xs text-text-tertiary mt-0.5">
                              {formatDate(wd.createdAt) ?? new Date(wd.createdAt).toLocaleDateString('en-IN')}
                            </p>
                            {wd.processedAt && (
                              <p className="text-xs text-text-tertiary">
                                Processed {formatDate(wd.processedAt)}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text capitalize">{wd.payoutMethod}</p>
                            {wd.payoutDetails && typeof wd.payoutDetails === 'object' && (
                              <p className="text-xs text-text-secondary truncate">
                                {JSON.stringify(wd.payoutDetails)}
                              </p>
                            )}
                          </div>
                          <p className="text-sm font-bold text-text tabular-nums text-right">
                            ₹{Number(wd.amount).toLocaleString('en-IN')}
                          </p>
                          <div className="flex flex-col items-end gap-1">
                            <span className={cn(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize shrink-0',
                              WD_STATUS_COLORS[wd.status] ?? 'bg-muted',
                            )}>
                              {wd.status}
                            </span>
                            {wd.failureReason && (
                              <p className="text-xs text-destructive max-w-32 truncate" title={wd.failureReason}>
                                {wd.failureReason}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {wdTotal > withdrawals.length && (
                  <div className="flex justify-end mt-2 shrink-0">
                    <Button
                      variant="outline" size="sm" className="text-xs"
                      onClick={() => fetchWithdrawals(wdPage + 1)}
                      disabled={loadingWd}
                    >
                      {loadingWd ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                      Load More
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* ── Adjustment dialog ─────────────────────────────────────── */}
        <Dialog open={adjustOpen} onOpenChange={(o) => !o && setAdjustOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adjust Wallet Balance</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Current Balance</Label>
                <p className="text-sm font-semibold text-text">₹{Number(balance).toLocaleString('en-IN')}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Amount <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 500 or -200"
                  value={adjustAmount}
                  onChange={(e) => { setAdjustAmount(e.target.value); setAdjustError('') }}
                />
                <p className="text-xs text-text-tertiary">Positive = credit (add money), Negative = debit (deduct)</p>
              </div>
              <div className="space-y-1.5">
                <Label>Reason <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. Correcting erroneous reward credit"
                  value={adjustReason}
                  onChange={(e) => { setAdjustReason(e.target.value); setAdjustError('') }}
                />
              </div>
              {adjustError && <p className="text-sm text-destructive">{adjustError}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
              <Button onClick={handleAdjust} disabled={adjusting}>
                {adjusting ? 'Applying…' : 'Apply Adjustment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </DialogContent>
    </Dialog>
  )
}