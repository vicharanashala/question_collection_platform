/**
 * WalletDetailModal — shared between WalletsPage and WithdrawalsPage.
 * Shows user info, balance, earned/withdrawn totals, and full transaction +
 * withdrawal history tabs. Super admins can also manually adjust balance.
 */
import { useState, useEffect, useCallback } from 'react'
import { adminApi, getErrorMessage } from '@/api/client'
// import { useAuth } from '@/context/AuthContext'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDate, formatINRFull, getBalanceTextClass } from '@/lib/utils'
import {
  Wallet, ArrowUpRight, ArrowDownRight,
  RefreshCw, XCircle,
  Banknote, ArrowRightLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Transaction, WalletSummary } from '@/types'

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
  onClose: () => void,
  summary?: WalletSummary
}

function MobileLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">
      {children}
    </span>
  )
}

interface TxSummary {
  totalTransactions: number
  totalCredits: number
  totalDebits: number
  withdrawalTransactions: number
}

interface TransactionTableProps {
  items: Transaction[]
  loading: boolean
  loadingMore: boolean
  page: number
  limit: number
  total: number
  emptyText: string
  EmptyIcon: React.ElementType
  onLoadMore: () => void
}

function TransactionTable({
  items, loading, loadingMore, page, limit, total, emptyText, EmptyIcon, onLoadMore,
}: TransactionTableProps) {
  return (
    <>
      <div className="rounded-xl border border-border overflow-x-auto flex flex-col flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-h-0 md:min-w-[780px]">
        <div className="hidden md:grid md:grid-cols-[3rem_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] md:gap-4 px-4 py-2.5 bg-muted/60 text-[11px] sm:text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
          <span className="text-center">S.No</span>
          <span>Source &amp; Description</span>
          <span>Type</span>
          <span className="text-right">Amount</span>
          <span className="text-center">Status</span>
          <span className="text-right">Balance</span>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 md:grid-cols-[3rem_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] md:gap-4 px-4 py-3.5 border-t border-border-subtle items-center">
                <Skeleton className="h-3 w-4" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-full max-w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-16 ml-auto" />
                <Skeleton className="h-5 w-20 mx-auto" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <EmptyIcon className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-xs sm:text-xs sm:text-sm font-medium text-muted-foreground">{emptyText}</p>
            </div>
          ) : (
            items.map((tx, idx) => (
              <div
                key={tx.id}
                className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-[3rem_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] md:gap-4 px-4 py-3 border-t border-border-subtle items-start md:items-center hover:bg-accent/40 transition-colors"
              >
                <span className="hidden text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground text-center tabular-nums md:block">
                  {(page - 1) * limit + idx + 1}
                </span>
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <p className="text-xs sm:text-xs sm:text-sm font-medium text-foreground truncate">
                    {TX_SOURCE_LABELS[tx.source] ?? tx.source}
                  </p>
                  <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground truncate">
                    {tx.description ?? '—'}
                  </p>
                  {tx.rejectionReason && (
                    <p className="text-[11px] sm:text-[11px] sm:text-xs text-destructive font-medium mt-0.5 flex items-center gap-1">
                      <XCircle className="h-3 w-3 shrink-0" />
                      {tx.rejectionReason}
                    </p>
                  )}
                  <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground/70 mt-0.5">
                    {formatDate(tx.createdAt) ?? new Date(tx.createdAt).toLocaleDateString('en-IN')}
                  </p>
                  {tx.referenceId && (
                    <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                      Ref: {tx.referenceId}
                    </p>
                  )}
                </div>
                <div>
                  <MobileLabel>Type</MobileLabel>
                  <div className={cn('flex items-center gap-1 text-[11px] sm:text-[11px] sm:text-xs font-semibold', TX_TYPE_COLORS[tx.type] ?? 'text-foreground')}>
                    {tx.type === 'credit'
                      ? <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />
                      : <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                    }
                    <span className="capitalize">{tx.type}</span>
                  </div>
                </div>
                <div>
                  <MobileLabel>Amount</MobileLabel>
                  <p className={cn('text-xs sm:text-xs sm:text-sm font-bold tabular-nums md:text-right', TX_TYPE_COLORS[tx.type] ?? 'text-foreground')}>
                    {tx.type === 'credit' ? '+' : '−'}₹{formatINRFull(Number(tx.amount))}
                  </p>
                </div>
                <div>
                  <MobileLabel>Status</MobileLabel>
                  <div className="flex items-center md:justify-center">
                    <span className={cn(
                      'inline-block rounded-full px-2 py-0.5 text-[11px] sm:text-[11px] sm:text-xs font-semibold capitalize',
                      TX_STATUS_COLORS[tx.status] ?? 'bg-muted',
                    )}>
                      {tx.status}
                    </span>
                  </div>
                </div>
                <div>
                  <MobileLabel>Balance</MobileLabel>
                  <p className="text-xs sm:text-sm font-medium text-foreground tabular-nums md:text-right">
                    {tx.balanceAfter != null ? `₹${formatINRFull(Number(tx.balanceAfter))}` : '—'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
        </div>
      </div>
      {loadingMore && items.length > 0 && (
        <div className="flex justify-center py-2">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && items.length < total && (
        <div className="flex justify-end mt-2 shrink-0">
          <Button
            variant="outline" size="sm" className="text-[11px] sm:text-[11px] sm:text-xs"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
            Load More
          </Button>
        </div>
      )}
    </>
  )
}

export function WalletDetailModal({ userId, open, onClose }: WalletDetailModalProps) {
  // const { user: currentUser } = useAuth()
  // const isSuperAdmin = currentUser?.role === 'super_admin'

  const [txTab, setTxTab] = useState<'transactions' | 'withdrawals'>('transactions')
  const [txPage, setTxPage] = useState(1)
  const [wdPage, setWdPage] = useState(1)
  const [loadingTx, setLoadingTx] = useState(false)
  const [loadingWd, setLoadingWd] = useState(false)
  const [loadingWallet, setLoadingWallet] = useState(false)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawals, setWithdrawals] = useState<Transaction[]>([])
  const [wdTotal, setWdTotal] = useState(0)
  const [txSummary, setTxSummary] = useState<TxSummary>({ totalTransactions: 0, totalCredits: 0, totalDebits: 0, withdrawalTransactions: 0 })

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

  const fetchBalance = useCallback(async () => {
    try {
      const wallet = await adminApi.getUserWallet(userId)
      setBalance(Number(wallet.balance))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load wallet balance'))
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

      // Summary covers every transaction of the wallet, not just this page.
      setTotalEarned(res.summary.totalCredits)
      setTotalWithdrawn(res.summary.totalDebits)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load transactions'))
    } finally {
      setLoadingTx(false)
    }
  }, [userId])

  const fetchWithdrawals = useCallback(async (page = 1) => {
    setLoadingWd(true)
    try {
      const res = await adminApi.getUserTransactions(userId, { page, limit, source: 'withdrawal' })
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
      Promise.all([fetchWithdrawals(1), fetchBalance()]).finally(() => setLoadingWallet(false))
    }
  }, [open, userId, fetchWalletUser, fetchTransactions, fetchWithdrawals, fetchBalance])

  const displayBalance = balance
  const isLoading = loadingTx && transactions.length === 0

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[calc(100vw-24px)] lg:max-w-6xl max-h-[90dvh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-lg sm:text-xl font-bold">
              <Wallet className="h-5 w-5 text-primary" />
              Wallet Details
              {walletUser && (
                <span className="text-xs sm:text-xs sm:text-sm font-normal text-muted-foreground ml-2">
                  · {walletUser.name}
                </span>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex h-[calc(90dvh-81px)] flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* ── Left panel ─────────────────────────────── */}
          <div className="w-full shrink-0 border-b border-border-subtle p-4 space-y-4 bg-muted/20 lg:w-72 lg:border-b-0 lg:border-r lg:overflow-y-auto lg:p-5">

            {/* User card */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg sm:text-lg sm:text-xl font-bold uppercase shrink-0">
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
                      <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground font-mono">{walletUser?.mobileNumber ?? '—'}</p>
                    </>
                  )}
                </div>
              </div>

              {!isLoading && walletUser && (
                <div className="flex flex-wrap gap-1.5">
                  {walletUser.category && (
                    <Badge variant="secondary" className="text-[11px] sm:text-[11px] sm:text-xs">{walletUser.category}</Badge>
                  )}
                  {walletUser.role && (
                    <Badge variant="secondary" className="text-[11px] sm:text-[11px] sm:text-xs capitalize">{walletUser.role}</Badge>
                  )}
                  {walletUser.verificationStatus && (
                    <Badge className={cn('text-[11px] sm:text-xs capitalize', VERIFICATION_COLORS[walletUser.verificationStatus] ?? 'bg-muted')}>
                      {walletUser.verificationStatus}
                    </Badge>
                  )}
                </div>
              )}

              {!isLoading && walletUser?.state && (
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <span>{walletUser.state}</span>
                </p>
              )}
              {!isLoading && walletUser?.createdAt && (
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">
                  Joined {formatDate(walletUser.createdAt) ?? new Date(walletUser.createdAt).toLocaleDateString('en-IN')}
                </p>
              )}
            </div>

            {/* Balance card */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wider font-medium">Current Balance</p>
              {isLoading || loadingWallet ? (
                <Skeleton className="h-10 w-36" />
              ) : (
                <p className={`${getBalanceTextClass(Number(displayBalance))} font-extrabold text-primary tabular-nums leading-none`}>
                  ₹{formatINRFull(Number(displayBalance))}
                </p>
              )}
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                <div className="flex items-center justify-between text-[11px] sm:text-[11px] sm:text-xs">
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
                <div className="flex items-center justify-between text-[11px] sm:text-[11px] sm:text-xs">
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
                      <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">Transactions</p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                      {txSummary.totalTransactions}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Banknote className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">Withdrawals</p>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{txSummary.withdrawalTransactions ?? 0}</p>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* ── Right panel ────────────────────────────── */}
          <div className="min-h-[28rem] flex-1 min-w-0 flex flex-col overflow-hidden p-4 lg:min-h-0 lg:p-5">
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
                    <Badge variant="secondary" className="ml-1.5 text-[11px] sm:text-[11px] sm:text-xs">
                      {txSummary.totalTransactions}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="withdrawals" className="gap-1.5">
                  <Banknote className="h-3.5 w-3.5" />
                  Withdrawals
                  {wdTotal > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[11px] sm:text-[11px] sm:text-xs">{wdTotal}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* ── Transactions tab ────────────────────── */}
              <TabsContent value="transactions" className="flex flex-col flex-1 min-h-0 mt-3">
                <TransactionTable
                  items={transactions}
                  loading={isLoading}
                  loadingMore={loadingTx}
                  page={txPage}
                  limit={limit}
                  total={txSummary.totalTransactions}
                  emptyText="No transactions yet"
                  EmptyIcon={ArrowRightLeft}
                  onLoadMore={() => fetchTransactions(txPage + 1)}
                />
              </TabsContent>

              {/* ── Withdrawals tab ─────────────────────── */}
              <TabsContent value="withdrawals" className="flex flex-col flex-1 min-h-0 mt-3">
                <TransactionTable
                  items={withdrawals}
                  loading={loadingWd && withdrawals.length === 0}
                  loadingMore={loadingWd}
                  page={wdPage}
                  limit={limit}
                  total={wdTotal}
                  emptyText="No withdrawals yet"
                  EmptyIcon={Banknote}
                  onLoadMore={() => fetchWithdrawals(wdPage + 1)}
                />
              </TabsContent>
            </Tabs>
          </div>


        </div>
      </DialogContent>
    </Dialog>
  )
}