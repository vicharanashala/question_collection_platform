/**
 * WithdrawalDetailModal — shows full details of a single withdrawal request
 * and allows super admins to approve/reject it inline with a reason dialog.
 */
import { useState, useEffect } from 'react'
import { adminApi, getErrorMessage } from '@/api/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDate } from '@/lib/utils'
import { ReasonDialog } from '@/components/ReasonDialog'
import {
  CheckCircle, XCircle, Clock, Hash, User, Phone,
  CreditCard, Wallet, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Withdrawal } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-warning text-white',
  processing: 'bg-ai_review text-white',
  completed:  'bg-success text-white',
  rejected:   'bg-destructive text-white',
  cancelled:  'bg-muted text-muted-foreground',
}

interface WithdrawalDetailModalProps {
  withdrawal: Withdrawal
  open: boolean
  onClose: () => void
  /** Called after a successful approve/reject to remove the item from the list */
  onActioned?: (id: string) => void
  /** When true, hides admin action buttons (approve/reject) for non-admin users */
  readOnly?: boolean
}

export function WithdrawalDetailModal({ withdrawal: initial, open, onClose, onActioned, readOnly = false }: WithdrawalDetailModalProps) {
  const [withdrawal, setWithdrawal] = useState<Withdrawal>(initial)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

  // Reason dialog state
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
    if (processing) return  // guard: prevent double-call
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

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Hash className="h-4 w-4 text-muted-foreground" />
              Withdrawal Details
            </DialogTitle>
          </DialogHeader>

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
            <div className="space-y-5 py-2">

              {/* Status banner */}
              <div className="flex items-center justify-between">
                <span className={cn(
                  'inline-block rounded-full px-3 py-1 text-sm font-semibold capitalize',
                  STATUS_COLORS[w.status] ?? 'bg-muted',
                )}>
                  {w.status}
                </span>
                {w.rejectionReason && (
                  <div className="flex items-start gap-1.5 max-w-xs">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive font-medium">{w.rejectionReason}</p>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Withdrawal Amount</p>
                <p className="text-4xl font-extrabold text-foreground tabular-nums">
                  ₹{Number(w.amount).toLocaleString('en-IN')}
                </p>
              </div>

              {/* Info grid */}
              <div className="rounded-lg border border-border-subtle divide-y divide-border-subtle">
                {/* User */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">User</p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {w.user?.name ?? 'Unknown'}
                    </p>
                  </div>
                </div>

                {/* Mobile */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Mobile</p>
                    <p className="text-sm font-medium text-foreground">{w.user?.mobileNumber ?? '—'}</p>
                  </div>
                </div>

                {/* Payout Method */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Payout Method</p>
                    <p className="text-sm font-medium text-foreground capitalize">{w.payoutMethod ?? '—'}</p>
                  </div>
                </div>

                {/* Payout Details */}
                {w.payoutDetails && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <Wallet className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Payout Details</p>
                      <p className="text-sm font-medium text-foreground break-all">
                        {typeof w.payoutDetails === 'string'
                          ? w.payoutDetails
                          : JSON.stringify(w.payoutDetails)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Requested On */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Requested On</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatDate(w.createdAt) ?? new Date(w.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>

                {/* Processed On */}
                {w.processedAt && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Processed On</p>
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(w.processedAt) ?? new Date(w.processedAt).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                )}


              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {!readOnly && isPending && (
              <>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
                  variant="ghost"
                  className="text-success hover:text-success hover:bg-success/10"
                  onClick={() => handleAction('approve')}
                  disabled={processing}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  {processing ? 'Processing…' : 'Approve'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reason dialog */}
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