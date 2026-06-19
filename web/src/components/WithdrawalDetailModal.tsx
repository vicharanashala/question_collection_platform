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
import { cn, formatDate } from '@/lib/utils'
import { ReasonDialog } from '@/components/ReasonDialog'
import {
  CheckCircle, XCircle, User, Phone, CreditCard, Wallet,
  CalendarDays, Building2, Hash, ArrowRightLeft, ShieldCheck,
  MapPin, Banknote, Copy, CheckCheck, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Withdrawal } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-warning text-white',
  processing: 'bg-blue-500 text-white',
  completed:  'bg-success text-white',
  rejected:   'bg-destructive text-white',
  cancelled:  'bg-muted text-muted-foreground',
}

const STATUS_LABELS: Record<string, string> = {
  pending:    'Pending',
  processing: 'Processing',
  completed:  'Completed',
  rejected:   'Rejected',
  cancelled:  'Cancelled',
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

function SectionHeader({ icon: Icon, label }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 bg-muted/60 border-b border-border-subtle rounded-t-xl">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}

function DataRow({ icon: Icon, label, value, mono, children }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string
  mono?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4 border-b border-border-subtle last:border-0">
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {children ?? (
          <p className={cn('text-sm font-semibold text-foreground leading-snug', mono && 'font-mono')}>
            {value || <span className="italic">—</span>}
          </p>
        )}
      </div>
    </div>
  )
}

export function WithdrawalDetailModal({
  withdrawal: initial, open, onClose, onActioned, readOnly = false,
}: WithdrawalDetailModalProps) {
  const [withdrawal, setWithdrawal] = useState<Withdrawal>(initial)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [reasonDialog, setReasonDialog] = useState<{
    open: boolean
    mode: 'approve' | 'reject'
    amount: number
    userName: string
  } | null>(null)

  useEffect(() => {
    if (open) {
      setWithdrawal(initial)
      setLoading(false)
      setProcessing(false)
      setReasonDialog(null)
    }
  }, [open, initial])

  async function handleAction(mode: 'approve' | 'reject', reason?: string) {
    if (processing) return
    setProcessing(true)
    try {
      const res = await adminApi.processWithdrawal(withdrawal.id, { action: mode, rejectionReason: reason })
      if (mode === 'reject') {
        toast.success('Withdrawal rejected')
        onActioned?.(withdrawal.id)
        onClose()
        return
      }
      // Approve path
      if (res.paymentFailed) {
        toast.error(
          `Payout dispatch failed${res.errorMessage ? ': ' + res.errorMessage : ''} (${res.errorCode ?? 'unknown'})`,
          { duration: 6000 },
        )
        // Keep modal open so admin can see the failure — refresh withdrawal state
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
  if (payout.upiId)  payoutFields.push({ icon: Wallet,     label: 'UPI ID',          value: payout.upiId })
  if (payout.vpa)    payoutFields.push({ icon: Wallet,     label: 'VPA',             value: payout.vpa })
  if (payout.bankName) payoutFields.push({ icon: Building2, label: 'Bank Name',       value: payout.bankName })
  if (payout.accountNumber) {
    payoutFields.push({ icon: Building2, label: 'Account Number', value: payout.accountNumber })
    if (payout.accountHolder) payoutFields.push({ icon: ShieldCheck, label: 'Account Holder', value: payout.accountHolder })
    if (payout.ifsc)          payoutFields.push({ icon: Building2,  label: 'IFSC Code',       value: payout.ifsc })
  }
  if (payout.utr)          payoutFields.push({ icon: ArrowRightLeft, label: 'UTR Number',      value: payout.utr })
  if (payout.transactionId) payoutFields.push({ icon: Hash,           label: 'Transaction ID',  value: payout.transactionId })
  if (payout.refId)         payoutFields.push({ icon: Hash,           label: 'Reference ID',     value: payout.refId })

  // Fallback: any unhandled payout fields
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

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden" style={{ maxHeight: '90vh' }}>

          {/* ── Header ──────────────────────────────────────── */}
          <DialogHeader className="px-6 pt-6 pb-5 border-b border-border-subtle shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 shrink-0">
                  <Banknote className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold leading-none">
                    Withdrawal Request
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={cn(
                      'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                      STATUS_COLORS[w.status] ?? 'bg-muted',
                    )}>
                      {STATUS_LABELS[w.status] ?? w.status}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">{w.id}</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground mb-0.5">Withdrawal Amount</p>
                <p className="text-4xl font-extrabold text-foreground tabular-nums leading-none">
                  ₹{Number(w.amount).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Rejection reason banner */}
            {w.rejectionReason && (
              <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 mt-4">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive">Rejection Reason</p>
                  <p className="text-sm text-foreground mt-0.5">{w.rejectionReason}</p>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* ── Body ───────────────────────────────────────── */}
          <div className="shrink-0 overflow-hidden" style={{ height: 'calc(90vh - 220px)', maxHeight: 'calc(90vh - 220px)' }}>
            <div className="h-full overflow-y-auto p-8">
              {isLoading ? (
                <div className="space-y-6">
                  {[
                    [2, 3],
                    [2, 1],
                    [1, 2],
                  ].map(([rows, cols], gi) => (
                    <div key={gi} className="rounded-xl border border-border bg-card overflow-hidden">
                      <div className="px-5 py-3.5 bg-muted/60 border-b border-border-subtle">
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <div className="p-3">
                        {Array.from({ length: rows as number }).map((_, i) => (
                          <div key={i} className="flex items-start gap-4 px-4 py-4 border-b border-border-subtle last:border-0">
                            <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-2 pt-1">
                              <Skeleton className="h-2.5 w-20" />
                              <Skeleton className="h-3.5 w-36" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[1fr_320px] gap-8">

                  {/* ── Left column ── User + Withdrawal ───── */}
                  <div className="space-y-6">

                    {/* User info */}
                    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                      <SectionHeader icon={User} label="User Information" />
                      <div className="p-3">
                        <DataRow icon={User}   label="Full Name"     value={w.user?.name} />
                        <DataRow icon={Phone}  label="Mobile Number" value={w.user?.mobileNumber} />
                        <DataRow icon={MapPin} label="State"         value={w.user?.state} />
                      </div>
                    </div>

                    {/* Withdrawal info */}
                    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                      <SectionHeader icon={Hash} label="Withdrawal Details" />
                      <div className="p-2">
                        <DataRow
                          icon={CalendarDays}
                          label="Requested On"
                          value={w.createdAt ? formatDisplayDate(w.createdAt) : undefined}
                        />
                        {w.processedAt && (
                          <DataRow
                            icon={CalendarDays}
                            label="Processed On"
                            value={formatDisplayDate(w.processedAt)}
                          />
                        )}
                        <div className="flex items-start gap-3 px-5 py-4 border-b border-border-subtle last:border-0">
                          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted shrink-0">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p className="text-xs text-muted-foreground mb-1">Payout Method</p>
                            <Badge variant="secondary" className="text-xs capitalize font-medium">
                              {w.payoutMethod?.replace(/_/g, ' ') ?? '—'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Right column ── Payout Details ──────── */}
                  <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden h-fit sticky top-0">
                    <SectionHeader icon={Wallet} label="Payout Details" />
                    <div className="p-3">
                      {hasPayoutDetails ? (
                        payoutFields.map(({ icon, label, value }) => (
                          <DataRow key={label} icon={icon} label={label} mono>
                            <Copyable value={value} />
                          </DataRow>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-muted">
                            <Wallet className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">No payout details</p>
                          <p className="text-xs text-muted-foreground text-center px-4">
                            Payout information was not recorded
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>

          {/* ── Footer ─────────────────────────────────────── */}
          <div className="shrink-0 px-6 py-5 border-t border-border-subtle bg-muted/20 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            {!readOnly && isPending && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setReasonDialog({
                    open: true,
                    mode: 'reject',
                    amount: w.amount,
                    userName: w.user?.name ?? w.user?.mobileNumber ?? '',
                  })}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="bg-success hover:bg-success/90 text-white"
                  onClick={() => handleAction('approve')}
                  disabled={processing}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  {processing ? 'Processing…' : 'Approve Withdrawal'}
                </Button>
              </div>
            )}
            {!readOnly && !isPending && (
              <p className="text-xs text-muted-foreground italic">
                Already {w.status}.
              </p>
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
          onConfirm={(reason) => {
            setReasonDialog(null)
            handleAction('reject', reason)
          }}
        />
      )}
    </>
  )
}

// Need Info icon — using inline span as fallback
function Info({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center justify-center w-4 h-4 text-muted-foreground', className)}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 5v.01M8 7.5v3" strokeLinecap="round" />
      </svg>
    </span>
  )
}