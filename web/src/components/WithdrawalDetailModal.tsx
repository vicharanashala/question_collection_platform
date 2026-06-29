/**
 * WithdrawalDetailModal — redesigned withdrawal request detail view.
 * Super admin can approve/reject from here.
 */
import { useState, useEffect } from 'react'
import { adminApi, getErrorMessage } from '@/api/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ReasonDialog } from '@/components/ReasonDialog'
import {
  CheckCircle, XCircle, User, Phone, CreditCard, Wallet,
  CalendarDays, Building2, Hash, ArrowRightLeft, ArrowDownCircle,
  ArrowUpCircle, ShieldCheck, MapPin, Banknote, Copy, CheckCheck,
  AlertTriangle, RefreshCw, Clock, BadgeCheck, ScrollText,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Withdrawal, AuditLogEntry, AuditEntityHistoryResponse, PaymentLogEntry } from '@/types'
import { auditApi } from '@/api/client'

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-warning text-white',
  processing: 'bg-blue-500 text-white',
  completed:  'bg-success text-white',
  rejected:   'bg-destructive text-white',
  cancelled:  'bg-muted text-muted-foreground',
  failed:     'bg-destructive text-white',
}

const STATUS_LABELS: Record<string, string> = {
  pending:    'Pending',
  processing: 'Processing',
  completed:  'Completed',
  rejected:   'Rejected',
  cancelled:  'Cancelled',
  failed:     'Failed',
}

interface PayoutDetails {
  bankName?: string
  accountNumber?: string
  accountHolder?: string
  ifsc?: string
  upiId?: string
  vpa?: string
  utr?: string
  transactionId?: string
  refId?: string
  [key: string]: unknown
}

interface WithdrawalDetailModalProps {
  withdrawal: Withdrawal
  open: boolean
  onClose: () => void
  onActioned?: (id: string) => void
  readOnly?: boolean
}

function Copyable({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="truncate font-mono text-sm font-medium text-foreground">{value}</span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        title="Copy"
      >
        {copied
          ? <CheckCheck className="h-3.5 w-3.5 text-success" />
          : <Copy className="h-3.5 w-3.5" />
        }
      </button>
    </span>
  )
}

function Info({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={cn('w-4 h-4', className)}>
      <circle cx="8" cy="8" r="6.5" />
      <path d="M8 5v.01M8 7.5v3" strokeLinecap="round" />
    </svg>
  )
}

export function WithdrawalDetailModal({
  withdrawal: initial, open, onClose, onActioned, readOnly = false,
}: WithdrawalDetailModalProps) {
  const [withdrawal, setWithdrawal] = useState<Withdrawal>(initial)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transactions, setTransactions] = useState<Array<{
    id: string; type: string; amount: number; status: string;
    rejectionReason: string | null; description: string; source: string; createdAt: string;
  }>>([])
  const [paymentLogs, setPaymentLogs] = useState<PaymentLogEntry[]>([])
  const [reasonDialog, setReasonDialog] = useState<{
    open: boolean
    mode: 'approve' | 'reject' | 'fail'
    amount: number
    userName: string
    initialReason?: string
  } | null>(null)

  // Audit history (super_admin)
  const [auditCollapsed, setAuditCollapsed] = useState(true)
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const AUDIT_PAGE_SIZE = 10

  useEffect(() => {
    if (!open) return
    setWithdrawal(initial)
    setLoading(true)
    setProcessing(false)
    setReasonDialog(null)
    setTransactions([])
    // Reset audit state
    setAuditCollapsed(true)
    setAuditEntries([])
    setAuditLoading(false)

    adminApi.getWithdrawalWithTransactions(initial.id).then((data) => {
      setWithdrawal(data as any)
      setTransactions((data as any).transactions ?? [])
      setPaymentLogs((data as any).paymentLogs ?? [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [open, initial.id])

  async function loadAuditHistory() {
    if (auditEntries.length > 0) {
      setAuditCollapsed((c) => !c)
      return
    }
    setAuditLoading(true)
    try {
      const res = await auditApi.getEntityHistory('withdrawal_request', initial.id)
      setAuditEntries((res as AuditEntityHistoryResponse).entries)
      setAuditCollapsed(false)
      setAuditPage(1)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load audit history'))
    } finally {
      setAuditLoading(false)
    }
  }

  async function handleAction(mode: 'approve' | 'reject' | 'fail', reason?: string) {
    if (processing) return
    setProcessing(true)
    try {
      if (mode === 'fail') {
        await adminApi.markWithdrawalFailed(withdrawal.id, reason ?? '')
        toast.success('Transaction marked as failed')
        onActioned?.(withdrawal.id)
        onClose()
        return
      }
      const res = await adminApi.processWithdrawal(withdrawal.id, { action: mode, rejectionReason: reason })
      if (mode === 'reject') {
        toast.success('Withdrawal rejected')
        onActioned?.(withdrawal.id)
        onClose()
        return
      }
      if (res.paymentFailed) {
        toast.error(
          `Payout dispatch failed${res.errorMessage ? ': ' + res.errorMessage : ''} (${res.errorCode ?? 'unknown'})`,
          { duration: 6000 },
        )
        setWithdrawal((prev) => ({ ...prev, status: 'processing' }))
        onActioned?.(withdrawal.id)
      } else {
        toast.success('Withdrawal approved and completed')
        onActioned?.(withdrawal.id)
        onClose()
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to process withdrawal'))
    } finally {
      setProcessing(false)
    }
  }

  const w = withdrawal
  const isPending = w.status === 'pending'
  const payout = (w.payoutDetails ?? {}) as PayoutDetails

  function formatDisplayDate(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
    }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const payoutFields: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string }> = []
  if (payout.upiId)         payoutFields.push({ icon: Wallet,     label: 'UPI ID',            value: payout.upiId })
  if (payout.vpa)           payoutFields.push({ icon: Wallet,     label: 'VPA',               value: payout.vpa })
  if (payout.bankName)      payoutFields.push({ icon: Building2,  label: 'Bank Name',         value: payout.bankName })
  if (payout.accountNumber) payoutFields.push({ icon: Building2,  label: 'Account Number',    value: payout.accountNumber })
  if (payout.accountHolder) payoutFields.push({ icon: ShieldCheck,label: 'Account Holder',    value: payout.accountHolder })
  if (payout.ifsc)          payoutFields.push({ icon: Building2,  label: 'IFSC Code',         value: payout.ifsc })
  if (payout.utr)           payoutFields.push({ icon: ArrowRightLeft, label: 'UTR Number',      value: payout.utr })
  if (payout.transactionId) payoutFields.push({ icon: Hash,        label: 'Transaction ID',   value: payout.transactionId })
  if (payout.refId)         payoutFields.push({ icon: Hash,        label: 'Reference ID',     value: payout.refId })

  const knownKeys = new Set(['bankName','accountNumber','accountHolder','ifsc','upiId','vpa','utr','transactionId','refId'])
  Object.entries(payout).filter(([k, v]) => !knownKeys.has(k) && v).forEach(([k, v]) => {
    payoutFields.push({
      icon: Info as React.ComponentType<{ className?: string }>,
      label: k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim(),
      value: String(v),
    })
  })

  const hasPayoutDetails = payoutFields.length > 0
  const isLoading = loading || (isPending && !withdrawal.user)

  const hasFailedDebitTx = transactions.some((tx) => tx.type === 'debit' && tx.status === 'failed')
  const hasCompletedDebitTx = transactions.some((tx) => tx.type === 'debit' && tx.status === 'completed')

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl p-0 gap-0 flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

          {/* ── Header ──────────────────────────────────────── */}
          <DialogHeader className="px-6 pt-6 pb-5 shrink-0">
            {/* Top row: icon + title block | amount */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-primary/10 shrink-0">
                  <Banknote className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold leading-none">Withdrawal Request</DialogTitle>
                  {/* ID */}
                  <p className="text-xs text-muted-foreground font-mono mt-1">{w.id}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-3xl font-extrabold text-foreground tabular-nums leading-none">
                  ₹{Number(w.amount).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Status + attempt badge row */}
            <div className="flex items-center gap-2 mt-3">
              <span className={cn(
                'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                STATUS_COLORS[w.status] ?? 'bg-muted',
              )}>
                {STATUS_LABELS[w.status] ?? w.status}
              </span>
              {(w.retryCount ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  <RefreshCw className="h-3 w-3" />
                  Attempt {(w.retryCount ?? 0) + 1}
                </span>
              )}
            </div>

            {/* Rejection / Failure reason banner */}
            {(w.rejectionReason || w.failureReason) && (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 mt-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive">
                    {w.status === 'failed' ? 'Failure Reason' : 'Rejection Reason'}
                  </p>
                  <p className="text-sm text-foreground mt-0.5">
                    {w.status === 'failed' ? w.failureReason : w.rejectionReason}
                  </p>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* ── Body ───────────────────────────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">

            {isLoading ? (
              <div className="space-y-3 py-2">
                {[4, 3, 5, 3].map((h, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">

                {/* ── User Info ───────────────────────────────── */}
                <Section label="User Information" icon={User}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Full Name"     value={w.user?.name} />
                    <Field label="Mobile"        value={w.user?.mobileNumber} />
                    <Field label="State"         value={w.user?.state} />
                    <Field label="Category"      value={w.user?.category} />
                  </div>
                </Section>

                {/* ── Withdrawal Details ─────────────────────── */}
                <Section label="Withdrawal Details" icon={Hash}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Requested On"
                      value={w.createdAt ? formatDisplayDate(w.createdAt) : undefined}
                    />
                    {w.processedAt && (
                      <Field
                        label="Processed On"
                        value={formatDisplayDate(w.processedAt)}
                      />
                    )}
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Payout Method</p>
                      <Badge variant="secondary" className="text-xs capitalize font-medium">
                        {w.payoutMethod?.replace(/_/g, ' ') ?? '—'}
                      </Badge>
                    </div>
                    {w.utrNumber && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">UTR Number</p>
                        <Copyable value={w.utrNumber} />
                      </div>
                    )}
                    {w.razorpayPayoutId && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">Razorpay Payout ID</p>
                        <Copyable value={w.razorpayPayoutId} />
                      </div>
                    )}
                  </div>
                </Section>

                {/* ── Payout Details ─────────────────────────── */}
                <Section label="Payout Details" icon={Wallet}>
                  {hasPayoutDetails ? (
                    <div className="grid grid-cols-2 gap-3">
                      {payoutFields.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="col-span-1">
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <Copyable value={value} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No payout details recorded.</p>
                  )}
                </Section>

                {/* ── Transaction History ─────────────────────── */}
                {transactions.length > 0 && (
                  <Section label="Transaction History" icon={ArrowRightLeft}>
                    <div className="space-y-2">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle px-3 py-2.5 bg-muted/20">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={cn(
                              'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
                              tx.source.toLowerCase() === 'withdrawal'
                                ? tx.status === 'failed'
                                  ? 'bg-destructive/10'
                                  : 'bg-primary/10'
                                : 'bg-success/10',
                            )}>
                              {tx.source.toLowerCase() === 'withdrawal'
                                ? <ArrowDownCircle className={cn('h-4 w-4', tx.status === 'failed' ? 'text-destructive' : 'text-primary')} />
                                : <ArrowUpCircle className="h-4 w-4 text-success" />
                              }
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground capitalize">
                                {tx.source.toLowerCase()} · {tx.description ?? tx.type}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDisplayDate(tx.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={cn(
                              'text-sm font-bold tabular-nums',
                              tx.source.toLowerCase() === 'withdrawal' ? 'text-foreground' : 'text-success',
                            )}>
                              {tx.source.toLowerCase() === 'withdrawal' ? '-' : '+'}₹{Number(tx.amount).toLocaleString('en-IN')}
                            </p>
                            <span className={cn(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize mt-0.5',
                              tx.status === 'completed' && 'bg-success/10 text-success',
                              tx.status === 'failed'    && 'bg-destructive/10 text-destructive',
                              tx.status === 'pending'   && 'bg-muted text-muted-foreground',
                              tx.status === 'processing' && 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
                            )}>
                              {tx.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── Payment Attempts ─────────────────────────── */}
                {w.status === 'failed' && paymentLogs.length > 0 && (
                  <Section label="Payment Attempts" icon={RefreshCw}>
                    <div className="space-y-2">
                      {paymentLogs.map((pl, idx) => (
                        <div key={pl.id} className="rounded-lg border border-border-subtle px-3 py-2.5 bg-muted/20">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={cn(
                                'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
                                pl.status === 'failed' ? 'bg-destructive/10' :
                                pl.status === 'success'  ? 'bg-success/10' : 'bg-blue-500/10',
                              )}>
                                {pl.status === 'failed'
                                  ? <XCircle className="h-4 w-4 text-destructive" />
                                  : pl.status === 'success'
                                  ? <CheckCircle className="h-4 w-4 text-success" />
                                  : <RefreshCw className="h-4 w-4 text-blue-500" />
                                }
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground capitalize">
                                  Attempt {idx + 1} · {pl.status}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {pl.orderId && <span className="font-mono mr-2">{pl.orderId}</span>}
                                  {pl.pinelabsTransactionId && <span className="font-mono mr-2">PL: {pl.pinelabsTransactionId}</span>}
                                  {pl.razorpayPayoutId && <span className="font-mono mr-2">RZ: {pl.razorpayPayoutId}</span>}
                                </p>
                                {(pl.utrNumber || pl.razorpayPayoutId) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {pl.utrNumber && <span className="font-mono mr-2">UTR: {pl.utrNumber}</span>}
                                    {pl.razorpayPayoutId && <span className="font-mono">RZ Payout: {pl.razorpayPayoutId}</span>}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">
                                {pl.attemptedAt ? formatDisplayDate(pl.attemptedAt) : '—'}
                              </p>
                              <span className={cn(
                                'inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize mt-0.5',
                                pl.status === 'failed'    && 'bg-destructive/10 text-destructive',
                                pl.status === 'success'   && 'bg-success/10 text-success',
                                pl.status === 'pending'   && 'bg-muted text-muted-foreground',
                                pl.status === 'initiated' && 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
                              )}>
                                {pl.status}
                              </span>
                            </div>
                          </div>

                          {pl.errorCode && (
                            <div className="mt-2 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2">
                              <p className="text-xs font-semibold text-destructive">
                                {pl.errorCode}
                              </p>
                              {pl.errorMessage && (
                                <p className="text-xs text-foreground mt-0.5">{pl.errorMessage}</p>
                              )}
                            </div>
                          )}

                          {pl.rawResponse && Object.keys(pl.rawResponse).length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                Raw response ({Object.keys(pl.rawResponse).length} fields)
                              </summary>
                              <pre className="mt-1 rounded bg-muted p-2 text-xs font-mono text-muted-foreground overflow-auto max-h-32">
                                {JSON.stringify(pl.rawResponse, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* ── Audit History ───────────────────────────── */}
                <Section label="Audit History" icon={ScrollText}>
                  {/* Load button / count row */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      onClick={loadAuditHistory}
                      className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      {auditLoading
                        ? <span className="h-3 w-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                        : <ScrollText className="h-3 w-3" />}
                      {auditLoading
                        ? 'Loading...'
                        : auditCollapsed && auditEntries.length === 0
                          ? 'Load audit history'
                          : `${auditEntries.length} audit ${auditEntries.length === 1 ? 'entry' : 'entries'}`}
                    </button>
                    {!auditCollapsed && auditEntries.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {auditEntries.length} total
                      </span>
                    )}
                  </div>

                  {/* Empty state */}
                  {!auditCollapsed && auditEntries.length === 0 && !auditLoading && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                      <ScrollText className="h-7 w-7 opacity-25" />
                      <p className="text-xs">No audit history for this withdrawal</p>
                    </div>
                  )}

                  {/* Loading skeleton */}
                  {!auditCollapsed && auditLoading && (
                    <div className="space-y-2">
                      {[3, 2, 4].map((_, i) => (
                        <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                      ))}
                    </div>
                  )}

                  {/* Paginated entry list */}
                  {!auditCollapsed && auditEntries.length > 0 && !auditLoading && (
                    <>
                      <div className="space-y-2">
                        {auditEntries
                          .slice((auditPage - 1) * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE)
                          .map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-start gap-3 rounded-lg border border-border-subtle px-3 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors"
                            >
                              {/* Avatar initials */}
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0">
                                {(entry.actorName ?? entry.actorId ?? 'S').charAt(0).toUpperCase()}
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-foreground">
                                    {entry.actorName
                                      ? `${entry.actorName} (${entry.actorRole ?? entry.actorType})`
                                      : entry.actorId ?? 'System'}
                                  </span>
                                </div>
                                <Badge variant="secondary" className="mt-1 text-xs capitalize">
                                  {entry.action.replace(/_/g, ' ').toLowerCase()}
                                </Badge>
                                {entry.oldValue && entry.newValue && (
                                  <p className="mt-1 text-xs text-muted-foreground font-mono">
                                    {JSON.stringify(entry.oldValue)} → {JSON.stringify(entry.newValue)}
                                  </p>
                                )}
                              </div>
                              {/* Timestamp */}
                              <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap mt-1">
                                {formatDisplayDate(entry.createdAt)}
                              </span>
                            </div>
                          ))}
                      </div>

                      {/* Pagination */}
                      {auditEntries.length > AUDIT_PAGE_SIZE && (
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-subtle">
                          <span className="text-xs text-muted-foreground">
                            {(auditPage - 1) * AUDIT_PAGE_SIZE + 1}–{Math.min(auditPage * AUDIT_PAGE_SIZE, auditEntries.length)} of {auditEntries.length}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                              disabled={auditPage === 1}
                              className="h-7 w-7 flex items-center justify-center rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <span className="text-xs text-muted-foreground px-1">{auditPage}</span>
                            <button
                              onClick={() => setAuditPage((p) => p + 1)}
                              disabled={auditPage * AUDIT_PAGE_SIZE >= auditEntries.length}
                              className="h-7 w-7 flex items-center justify-center rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Section>

              </div>
            )}
          </div>

          {/* ── Footer ─────────────────────────────────────── */}
          <div className="shrink-0 px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>

            {/* Pending — approve / reject */}
            {!readOnly && isPending && (
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setReasonDialog({
                    open: true, mode: 'reject',
                    amount: w.amount,
                    userName: w.user?.name ?? w.user?.mobileNumber ?? '',
                  })}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-1.5" />Reject
                </Button>
                <Button
                  size="sm"
                  className="bg-success hover:bg-success/90 text-white"
                  onClick={() => handleAction('approve')}
                  disabled={processing}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  {processing ? 'Processing…' : 'Approve'}
                </Button>
              </div>
            )}

            {/* Failed (no debit tx yet) — retry / mark failed */}
            {!readOnly && !isPending && w.status === 'failed' && !hasFailedDebitTx && !hasCompletedDebitTx && (
              <div className="flex items-center gap-2.5">
                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-white"
                  onClick={async () => {
                    if (processing) return
                    setProcessing(true)
                    try {
                      const res = await adminApi.retryFailedWithdrawal(w.id)
                      if (res.paymentFailed) {
                        toast.error(`Retry failed${res.errorMessage ? ': ' + res.errorMessage : ''}`, { duration: 6000 })
                        setWithdrawal((prev) => ({ ...prev, status: res.status as any }))
                      } else {
                        toast.success('Payment succeeded — withdrawal completed')
                      }
                      onActioned?.(w.id)
                    } catch (e) {
                      toast.error(getErrorMessage(e, 'Retry failed'))
                    } finally {
                      setProcessing(false)
                    }
                  }}
                  disabled={processing}
                >
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  {processing ? 'Processing…' : 'Retry Payment'}
                </Button>
                <Button
                  size="sm"
                  className="bg-destructive hover:bg-destructive/90 text-white"
                  onClick={() => setReasonDialog({
                    open: true, mode: 'fail',
                    amount: w.amount,
                    userName: w.user?.name ?? w.user?.mobileNumber ?? '',
                    initialReason: w.failureReason ?? undefined,
                  })}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Mark Failed
                </Button>
              </div>
            )}

            {/* Completed / Rejected */}
            {!readOnly && !isPending && (w.status === 'completed' || w.status === 'rejected') && (
              <div className="flex items-center gap-1.5">
                {w.status === 'completed'
                  ? <><BadgeCheck className="h-4 w-4 text-success mr-1" /><span className="text-xs text-muted-foreground">Withdrawal completed</span></>
                  : <><XCircle className="h-4 w-4 text-muted-foreground mr-1" /><span className="text-xs text-muted-foreground">Withdrawal rejected</span></>
                }
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {reasonDialog && (
        <ReasonDialog
          open={reasonDialog.open}
          onOpenChange={(open) => setReasonDialog((prev) => prev ? { ...prev, open } : null)}
          mode={reasonDialog.mode}
          amount={reasonDialog.amount}
          userName={reasonDialog.userName}
          initialReason={reasonDialog.initialReason}
          onConfirm={(reason) => {
            const mode = reasonDialog!.mode
            setReasonDialog(null)
            if (mode === 'fail') handleAction('fail', reason)
            else handleAction('reject', reason)
          }}
        />
      )}
    </>
  )
}

function Section({
  label, icon: Icon, children,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border-subtle">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="p-3.5">
        {children}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground">
        {value || <span className="italic text-muted-foreground/60">—</span>}
      </p>
    </div>
  )
}