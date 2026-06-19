/**
 * WithdrawalDetailModal — full details of a single withdrawal request.
 * Supports approve/reject for super admins.
 */
import { useState, useEffect } from 'react'
import { adminApi, getErrorMessage } from '@/api/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDate } from '@/lib/utils'
import { ReasonDialog } from '@/components/ReasonDialog'
import {
  CheckCircle, XCircle, Hash, User, Phone,
  CreditCard, Wallet, AlertCircle, Building2,
  ArrowRightLeft, CalendarDays, ShieldCheck, MapPin,
  Banknote, Copy, CheckCheck, Info,
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

function Copyable({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="truncate font-mono text-xs">{value}</span>
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

function InfoCard({ icon: Icon, label, value, mono }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border-subtle last:border-0">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={cn('text-sm font-semibold text-foreground', mono && 'font-mono')}>
          {value || <span className="text-muted-foreground italic">Not available</span>}
        </p>
      </div>
    </div>
  )
}

export function WithdrawalDetailModal({ withdrawal: initial, open, onClose, onActioned, readOnly = false }: WithdrawalDetailModalProps) {
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
      await adminApi.processWithdrawal(withdrawal.id, { action: mode, rejectionReason: reason })
      toast.success(`Withdrawal ${mode === 'approve' ? 'approved' : 'rejected'}`)
      onActioned?.(withdrawal.id)
      onClose()
    } catch (e) {
      toast.error(getErrorMessage(e, `Failed to ${mode} withdrawal`))
    } finally {
      setProcessing(false)
    }
  }

  const w = withdrawal
  const isPending = w.status === 'pending'
  const payout = (w.payoutDetails ?? {}) as PayoutDetails

  const accountNumber = payout.accountNumber ?? ''
  const maskedAccount = accountNumber ? `XXXX${accountNumber.slice(-4)}` : ''

  const hasPayoutDetails = Boolean(
    payout.bankName || payout.accountNumber || payout.accountHolder ||
    payout.ifsc || payout.upiId || payout.vpa || payout.utr ||
    payout.transactionId || payout.refId ||
    Object.keys(payout).length > 0
  )

  function formatDisplayDate(iso: string): string {
    const d = new Date(iso)
    const datePart = d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
    const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    return `${datePart}, ${timePart}`
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* Header */}
          <DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b border-border bg-muted/20">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                  <Banknote className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    Withdrawal Request
                    <span className={cn(
                      'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                      STATUS_COLORS[w.status] ?? 'bg-muted',
                    )}>
                      {w.status}
                    </span>
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">{w.id}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-3xl font-extrabold text-foreground tabular-nums leading-none">
                  ₹{Number(w.amount).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Rejection reason */}
            {w.rejectionReason && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 mt-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-destructive">Rejection Reason</p>
                  <p className="text-sm text-foreground mt-0.5">{w.rejectionReason}</p>
                </div>
              </div>
            )}
          </DialogHeader>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {loading ? (
              <div className="space-y-4 py-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">

                {/* ── Left column ── User + Withdrawal info */}
                <div className="col-span-2 space-y-5">

                  {/* User Info */}
                  <div className="rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-2 px-5 py-3.5 bg-muted/60 border-b border-border rounded-t-xl">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        User Information
                      </span>
                    </div>
                    <div className="px-5 pb-1">
                      <InfoCard icon={User} label="Full Name" value={w.user?.name} />
                      <InfoCard icon={Phone} label="Mobile Number" value={w.user?.mobileNumber} />
                      <InfoCard icon={MapPin} label="State" value={w.user?.state} />
                    </div>
                  </div>

                  {/* Withdrawal Info */}
                  <div className="rounded-xl border border-border bg-card">
                    <div className="flex items-center gap-2 px-5 py-3.5 bg-muted/60 border-b border-border rounded-t-xl">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Withdrawal Details
                      </span>
                    </div>
                    <div className="px-5 pb-1">
                      <InfoCard icon={CalendarDays} label="Requested On" value={w.createdAt ? formatDisplayDate(w.createdAt) : undefined} />
                      {w.processedAt && (
                        <InfoCard icon={CalendarDays} label="Processed On" value={formatDisplayDate(w.processedAt)} />
                      )}
                      <div className="flex items-start gap-3 py-3 border-b border-border-subtle last:border-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground mb-0.5">Payout Method</p>
                          <Badge variant="secondary" className="text-xs capitalize mt-0.5">
                            {w.payoutMethod?.replace(/_/g, ' ') ?? '—'}
                          </Badge>
                        </div>
                      </div>
                      {payout.utr && (
                        <InfoCard icon={ArrowRightLeft} label="UTR Number" value={payout.utr as string} mono />
                      )}
                      {payout.transactionId && (
                        <InfoCard icon={ArrowRightLeft} label="Transaction ID" value={payout.transactionId as string} mono />
                      )}
                      {payout.refId && (
                        <InfoCard icon={Hash} label="Reference ID" value={payout.refId as string} mono />
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Right column ── Payout Details */}
                <div className="col-span-1">
                  <div className="rounded-xl border border-border bg-card h-full">
                    <div className="flex items-center gap-2 px-5 py-3.5 bg-muted/60 border-b border-border rounded-t-xl">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Payout Details
                      </span>
                    </div>
                    <div className="px-5 pb-1">
                      {hasPayoutDetails ? (
                        <>
                          {payout.bankName && (
                            <InfoCard icon={Building2} label="Bank Name" value={payout.bankName as string} />
                          )}
                          {accountNumber && (
                            <div className="py-3 border-b border-border-subtle last:border-0">
                              <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-muted-foreground mb-1">Account Number</p>
                                  <Copyable value={accountNumber} />
                                  {maskedAccount && maskedAccount !== accountNumber && (
                                    <p className="text-xs text-muted-foreground mt-1">{maskedAccount}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          {payout.accountHolder && (
                            <InfoCard icon={ShieldCheck} label="Account Holder" value={payout.accountHolder as string} />
                          )}
                          {payout.ifsc && (
                            <div className="py-3 border-b border-border-subtle last:border-0">
                              <div className="flex items-start gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs text-muted-foreground mb-1">IFSC Code</p>
                                  <Copyable value={payout.ifsc as string} />
                                </div>
                              </div>
                            </div>
                          )}
                          {payout.upiId && (
                            <InfoCard icon={Wallet} label="UPI ID" value={payout.upiId as string} mono />
                          )}
                          {payout.vpa && (
                            <InfoCard icon={Wallet} label="VPA" value={payout.vpa as string} mono />
                          )}
                          {/* Fallback for any other payout fields */}
                          {Object.entries(payout).filter(([k]) =>
                            !['bankName', 'accountNumber', 'accountNumberMasked', 'accountHolder',
                              'ifsc', 'upiId', 'vpa', 'utr', 'transactionId', 'refId'].includes(k)
                          ).map(([k, v]) => (
                            <InfoCard
                              key={k}
                              icon={Info}
                              label={k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                              value={String(v)}
                              mono
                            />
                          ))}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-3">
                            <Wallet className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">No payout details</p>
                          <p className="text-xs text-muted-foreground mt-1">Payout information not recorded</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Footer — Action buttons */}
          <DialogFooter className="shrink-0 px-6 py-4 border-t bg-muted/20 gap-3">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {!readOnly && isPending && (
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
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
              <p className="ml-auto text-xs text-muted-foreground italic">
                This withdrawal has already been {w.status}.
              </p>
            )}
          </DialogFooter>
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