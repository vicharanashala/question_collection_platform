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
import { cn, formatDate, formatINRFull, getBalanceTextClass } from '@/lib/utils'
import {
  Wallet, ArrowUpRight, ArrowDownRight,
  RefreshCw, TrendingUp, TrendingDown, Clock, Hash, X, Eye, XCircle,
  CreditCard, Banknote, ArrowRightLeft, User,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Transaction, Withdrawal } from '@/types'
import { WithdrawalDetailModal } from '@/components/WithdrawalDetailModal'

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
  adjustment: 'Manual Adjustment',
}

const TX_TYPE_COLORS: Record<string, string> = {
  credit: 'text-success',
  debit:  'text-destructive',
}

const WD_STATUS_COLORS: Record<string, string> = {
  pending:    'bg-warning text-white',
  processing: 'bg-blue-500 text-white',
  completed:  'bg-success text-white',
  rejected:   'bg-destructive text-white',
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
  userId: string
  open: boolean
  onClose: () => void
}

interface TxSummary {
  totalTransactions: number
  totalCredits: number
  totalDebits: number
}

export function WalletDetailModal({ userId, open, onClose }: WalletDetailModalProps) {
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [txTab, setTxTab] = useState<'transactions' | 'withdrawals'>('transactions')
  const [txPage, setTxPage] = useState(1)
  const [wdPage, setWdPage] = useState(1)
  const [loadingTx, setLoadingTx] = useState(false)
  const [loadingWd, setLoadingWd] = useState(false)
  const [loadingWallet, setLoadingWallet] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [wdTotal, setWdTotal] = useState(0)
  const [txSummary, setTxSummary] = useState<TxSummary>({ totalTransactions: 0, totalCredits: 0, totalDebits: 0 })

  // Wallet summary (fetched from first tx response — contains balance info)
  const [balance, setBalance] = useState(0)
  const [totalEarned, setTotalEarned] = useState(0)
  const [totalWithdrawn, setTotalWithdrawn] = useState(0)
  const [walletUser, setWalletUser] = useState<{
    name: string
    mobileNumber: string
    state: string
    category: string
    role: string
    verificationStatus: string
    createdAt: string
  } | null>(null)

  const [detailTarget, setDetailTarget] = useState<Withdrawal | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const limit = 15

  const fetchWalletUser = useCallback(async () => {
    try {
      const res = await adminApi.getUserDetail(userId)
      const u = res.user
      setWalletUser({
        name: u.name ?? '—',
        mobileNumber: u.mobileNumber ?? '—',
        state: u.state ?? '',
        category: u.category ?? '',
        role: u.role ?? '',
        verificationStatus: u.verificationStatus ?? '',
        createdAt: u.createdAt ?? '',
      })
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load user details'))
    }
  }, [userId])

  const fetchTransactions = useCallback(async (page = 1) => {
    setLoadingTx(true)
    try {
      const res = await adminApi.getUserTransactions(userId, { page, limit })
      setTxSummary(res.summary)
      if (page === 1) {
        setTransactions(res.items)
      } else {
        setTransactions((prev) => [...prev, ...res.items])
      }
      setTxPage(page)

      // On first load, extract user info from the first transaction's referenceId
      // and set balance from balanceAfter of the most recent transaction
      if (page === 1 && res.items.length > 0) {
        const latest = res.items.reduce(( newest, tx) =>
          new Date(tx.createdAt) > new Date(newest.createdAt) ? tx : newest, res.items[0])
        if (latest.balanceAfter != null) {
          setBalance(latest.balanceAfter)
        }
        // Estimate earned from totalCredits — totalDebits (net)
        setTotalEarned(res.summary.totalCredits)
        setTotalWithdrawn(res.summary.totalDebits)
      }
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
      if (page === 1) {
        setWithdrawals(res.items)
      } else {
        setWithdrawals((prev) => [...prev, ...res.items])
      }
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
      setBalance(0)
      setTotalEarned(0)
      setTotalWithdrawn(0)
      setWalletUser(null)
      setLoadingWallet(true)

      // Fetch user details + wallet summary in parallel
      fetchWalletUser()
      fetchTransactions(1)
      fetchWithdrawals(1).finally(() => setLoadingWallet(false))
    }
  }, [open, userId, fetchWalletUser, fetchTransactions, fetchWithdrawals])

  const displayBalance = balance
  const isLoading = loadingTx && transactions.length === 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl p-0 gap-0 overflow-hidden" style={{ maxHeight: '90vh' }}>
        <DialogHeader className="px-6 py-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Wallet className="h-5 w-5 text-primary" />
              Wallet Details
              {walletUser && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  · {walletUser.name}
                </span>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex overflow-hidden" style={{ height: 'calc(90vh - 81px)' }}>
          {/* ── Left panel ─────────────────────────────── */}
          <div className="w-72 shrink-0 border-r border-border-subtle overflow-y-auto p-5 space-y-4 bg-muted/20">

            {/* User card */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold uppercase shrink-0">
                  {walletUser?.name ? walletUser.name.charAt(0) : (loadingWallet ? '' : '?')}
                  {isLoading && <Skeleton className="h-10 w-10 rounded-full" />}
                </div>
                <div className="min-w-0">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-foreground truncate">{walletUser?.name ?? '—'}</p>
                      <p className="text-sm text-muted-foreground font-mono">{walletUser?.mobileNumber ?? '—'}</p>
                    </>
                  )}
                </div>
              </div>

              {!isLoading && walletUser && (
                <div className="flex flex-wrap gap-1.5">
                  {walletUser.category && (
                    <Badge variant="secondary" className="text-xs">{walletUser.category}</Badge>
                  )}
                  {walletUser.role && (
                    <Badge variant="secondary" className="text-xs capitalize">{walletUser.role}</Badge>
                  )}
                  {walletUser.verificationStatus && (
                    <Badge className={cn('text-xs capitalize', VERIFICATION_COLORS[walletUser.verificationStatus] ?? 'bg-muted')}>
                      {walletUser.verificationStatus}
                    </Badge>
                  )}
                </div>
              )}

              {!isLoading && walletUser?.state && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span>{walletUser.state}</span>
                </p>
              )}
              {!isLoading && walletUser?.createdAt && (
                <p className="text-xs text-muted-foreground">
                  Joined {formatDate(walletUser.createdAt) ?? new Date(walletUser.createdAt).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>

            {/* Balance card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Current Balance</p>
              {isLoading ? (
                <Skeleton className="h-10 w-36" />
              ) : (
                <p className={`${getBalanceTextClass(Number(displayBalance))} font-extrabold text-primary tabular-nums leading-none`}>
                  ₹{formatINRFull(Number(displayBalance))}
                </p>
              )}
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowDownRight className="h-3.5 w-3.5 text-success" />
                    Total Earned
                  </span>
                  {isLoading ? (
                    <Skeleton className="h-3 w-16" />
                  ) : (
                    <span className="font-semibold text-success tabular-nums">
                      ₹{formatINRFull(Number(totalEarned))}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                    Total Withdrawn
                  </span>
                  {isLoading ? (
                    <Skeleton className="h-3 w-16" />
                  ) : (
                    <span className="font-semibold text-destructive tabular-nums">
                      ₹{formatINRFull(Number(totalWithdrawn))}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {isLoading ? (
                <>
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-border bg-card p-3 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Transactions</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {txSummary.totalTransactions}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Banknote className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Withdrawals</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">{wdTotal}</p>
                  </div>
                </>
              )}
            </div>

            {/* Net summary */}
            {!isLoading && (
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Net Flow</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ArrowDownRight className="h-3 w-3 text-success" /> Credits
                    </span>
                    <span className="text-xs font-semibold text-success tabular-nums">
                      +₹{formatINRFull(Number(txSummary.totalCredits))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3 text-destructive" /> Debits
                    </span>
                    <span className="text-xs font-semibold text-destructive tabular-nums">
                      -₹{formatINRFull(Number(txSummary.totalDebits))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border-subtle pt-1.5">
                    <span className="text-xs font-medium text-foreground">Net</span>
                    <span className={cn(
                      'text-xs font-bold tabular-nums',
                      txSummary.totalCredits - txSummary.totalDebits >= 0 ? 'text-success' : 'text-destructive',
                    )}>
                      {txSummary.totalCredits - txSummary.totalDebits >= 0 ? '+' : ''}
                      ₹{formatINRFull(Number(txSummary.totalCredits - txSummary.totalDebits))}
                    </span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* ── Right panel ────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-5">
            <Tabs
              value={txTab}
              onValueChange={(v) => setTxTab(v as 'transactions' | 'withdrawals')}
              className="flex flex-col flex-1 min-h-0 overflow-hidden"
            >
              <TabsList className="grid w-full grid-cols-2 shrink-0">
                <TabsTrigger value="transactions" className="gap-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Transactions
                  {!isLoading && txSummary.totalTransactions > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-xs">
                      {txSummary.totalTransactions}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="withdrawals" className="gap-1.5">
                  <Banknote className="h-3.5 w-3.5" />
                  Withdrawals
                  {wdTotal > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-xs">{wdTotal}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* ── Transactions tab ────────────────────── */}
              <TabsContent value="transactions" className="flex flex-col flex-1 min-h-0 mt-3">
                <div className="rounded-xl border border-border overflow-hidden flex flex-col flex-1 min-h-0">
                  <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                    <span className="w-8 text-center">#</span>
                    <span>Details</span>
                    <span>Type</span>
                    <span className="text-right">Amount</span>
                    <span>Status</span>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {isLoading ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 px-4 py-3.5 border-t border-border-subtle items-center">
                          <Skeleton className="h-3 w-4" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-3 w-full max-w-36" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                          <Skeleton className="h-3 w-14" />
                          <Skeleton className="h-3 w-16 ml-auto" />
                          <Skeleton className="h-5 w-20" />
                        </div>
                      ))
                    ) : transactions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <ArrowRightLeft className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-sm font-medium text-muted-foreground">No transactions yet</p>
                      </div>
                    ) : (
                      transactions.map((tx, idx) => (
                        <div
                          key={tx.id}
                          className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-3 px-4 py-3 border-t border-border-subtle items-center hover:bg-accent/40 transition-colors"
                        >
                          <span className="text-xs text-muted-foreground w-8 text-center tabular-nums">
                            {(txPage - 1) * limit + idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {TX_SOURCE_LABELS[tx.source] ?? tx.source}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {tx.description ?? '—'}
                            </p>
                            {tx.rejectionReason && (
                              <p className="text-xs text-destructive font-medium mt-0.5 flex items-center gap-1">
                                <XCircle className="h-3 w-3 shrink-0" />
                                {tx.rejectionReason}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              {formatDate(tx.createdAt) ?? new Date(tx.createdAt).toLocaleDateString('en-IN')}
                            </p>
                            {tx.referenceId && (
                              <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                                Ref: {tx.referenceId}
                              </p>
                            )}
                          </div>
                          <div className={cn('flex items-center gap-1 text-xs font-semibold', TX_TYPE_COLORS[tx.type] ?? 'text-foreground')}>
                            {tx.type === 'credit'
                              ? <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                              : <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                            }
                            <span className="capitalize">{tx.type}</span>
                          </div>
                          <p className={cn('text-sm font-bold tabular-nums text-right', TX_TYPE_COLORS[tx.type] ?? 'text-foreground')}>
                            {tx.type === 'credit' ? '+' : '−'}₹{formatINRFull(Number(tx.amount))}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize',
                              TX_STATUS_COLORS[tx.status] ?? 'bg-muted',
                            )}>
                              {tx.status}
                            </span>
                            {tx.balanceAfter != null && (
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                → ₹{formatINRFull(Number(tx.balanceAfter))}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {loadingTx && transactions.length > 0 && (
                  <div className="flex justify-center py-2">
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!isLoading && transactions.length > 0 && (
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
                )}
              </TabsContent>

              {/* ── Withdrawals tab ─────────────────────── */}
              <TabsContent value="withdrawals" className="flex flex-col flex-1 min-h-0 mt-3">
                <div className="rounded-xl border border-border overflow-hidden flex flex-col flex-1">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-3 px-4 py-2.5 bg-muted/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                    <span>Request ID</span>
                    <span>Payout Method</span>
                    <span className="text-right">Amount</span>
                    <span>Status</span>
                    <span className="text-center">Details</span>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {loadingWd && withdrawals.length === 0 ? (
                      Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-3 px-4 py-3.5 border-t border-border-subtle items-center">
                          <Skeleton className="h-3 w-28" />
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-16 ml-auto" />
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-8 mx-auto" />
                        </div>
                      ))
                    ) : withdrawals.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <Banknote className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-sm font-medium text-muted-foreground">No withdrawals yet</p>
                      </div>
                    ) : (
                      withdrawals.map((wd) => (
                        <div
                          key={wd.id}
                          className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-3 px-4 py-3 border-t border-border-subtle items-center hover:bg-accent/40 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-mono text-muted-foreground truncate">{wd.id}</p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                              {formatDate(wd.createdAt) ?? new Date(wd.createdAt).toLocaleDateString('en-IN')}
                            </p>
                            {wd.processedAt && (
                              <p className="text-xs text-muted-foreground/70">
                                Processed {formatDate(wd.processedAt)}
                              </p>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground capitalize flex items-center gap-1.5">
                              <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              {wd.payoutMethod}
                            </p>
                            {wd.payoutDetails && typeof wd.payoutDetails === 'object' && (
                              <p className="text-xs text-muted-foreground truncate">
                                {Object.values(wd.payoutDetails as Record<string, unknown>).filter(Boolean).join(' · ') || '—'}
                              </p>
                            )}
                          </div>
                          <p className="text-sm font-bold text-foreground tabular-nums text-right">
                            ₹{formatINRFull(Number(wd.amount))}
                          </p>
                          <span className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize shrink-0',
                            WD_STATUS_COLORS[wd.status] ?? 'bg-muted',
                          )}>
                            {wd.status}
                          </span>
                          <div className="flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setDetailTarget(wd)
                                setDetailOpen(true)
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {wdTotal > withdrawals.length && !isLoading && (
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

          {/* ── Withdrawal detail modal (portal) ──────────────────── */}
          {detailTarget && (
            <WithdrawalDetailModal
              withdrawal={detailTarget}
              open={detailOpen}
              onClose={() => { setDetailOpen(false); setDetailTarget(null) }}
              onActioned={() => fetchWithdrawals(1)}
            />
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}