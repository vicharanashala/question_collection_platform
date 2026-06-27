import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 'approve' — optional note; 'reject' — required reason; 'fail' — required reason */
  mode: 'approve' | 'reject' | 'fail'
  amount: number
  userName: string
  onConfirm: (reason: string | undefined) => void
}

const MAX_REASON_LENGTH = 500

const SUGGESTED_REASONS: Record<'reject' | 'fail', string[]> = {
  reject: [
    'Invalid bank account number or UPI ID',
    'Account holder name does not match bank records',
    'Beneficiary account is closed or frozen',
    'IFS C code is incorrect or inactive',
    'Daily transfer limit exceeded by bank',
    'Duplicate withdrawal request — already processed',
    'Account does not belong to the registered user',
    'Withdrawal amount below minimum bank threshold',
  ],
  fail: [
    'Payment gateway rejected the transaction',
    'Beneficiary bank is not active for IMPS/NEFT',
    'Transaction timed out at payment processor',
    'Insufficient funds in platform payout account',
    'Bank system unavailable at time of processing',
    'UPI handle is invalid or deactivated',
    'Account closed by beneficiary after validation',
    'Transaction limit exceeded for this payment method',
  ],
}

export function ReasonDialog({ open, onOpenChange, mode, amount, userName, onConfirm }: ReasonDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      // Small delay to ensure dialog is visible before focusing
      const t = setTimeout(() => textareaRef.current?.focus(), 80)
      return () => clearTimeout(t)
    } else {
      setReason('')
      setError('')
    }
  }, [open])

  function handleConfirm() {
    if (mode === 'reject' || mode === 'fail') {
      const trimmed = reason.trim()
      if (!trimmed) {
        setError('Please provide a reason.')
        return
      }
      if (trimmed.length > MAX_REASON_LENGTH) {
        setError(`Reason must not exceed ${MAX_REASON_LENGTH} characters.`)
        return
      }
      onConfirm(trimmed)
    } else {
      onConfirm(reason.trim() || undefined)
    }
    setReason('')
    setError('')
    onOpenChange(false)
  }

  function handleCancel() {
    setReason('')
    setError('')
    onOpenChange(false)
  }

  function appendReason(suggestion: string) {
    setReason((prev) => (prev ? `${prev}\n${suggestion}` : suggestion))
    textareaRef.current?.focus()
  }

  function selectOnly(suggestion: string) {
    setReason(suggestion)
    textareaRef.current?.focus()
  }

  const suggestions = (mode === 'reject' || mode === 'fail') ? SUGGESTED_REASONS[mode] : []

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md w-full p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border-subtle shrink-0">
          <DialogTitle className="text-base font-semibold">
            {mode === 'approve' ? 'Approve Withdrawal' : mode === 'reject' ? 'Reject Withdrawal' : 'Mark Transaction as Failed'}
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {mode === 'approve'
              ? `You are about to approve a withdrawal of ₹${Number(amount).toLocaleString('en-IN')} for ${userName || 'this user'}.`
              : mode === 'reject'
              ? `Please provide a reason for rejecting the withdrawal of ₹${Number(amount).toLocaleString('en-IN')} for ${userName || 'this user'}.`
              : `Mark the transaction as failed for ₹${Number(amount).toLocaleString('en-IN')} for ${userName || 'this user'}. The amount will be credited back to the user's wallet. A reason is required.`}
          </p>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          {(mode === 'reject' || mode === 'fail') && (
            <>
              {/* Suggested reasons */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Suggested reasons <span className="text-muted-foreground/60 font-normal">(click to use)</span>
                </p>
                <div className="space-y-1.5">
                  {suggestions.map((suggestion, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <button
                        type="button"
                        className={cn(
                          'flex-1 text-left text-xs px-3 py-2 rounded-lg border transition-all duration-150 cursor-pointer',
                          'hover:shadow-sm',
                          'border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:border-destructive/40',
                        )}
                        onClick={() => selectOnly(suggestion)}
                        title="Replace reason with this suggestion"
                      >
                        {suggestion}
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'shrink-0 text-xs px-2 py-1.5 rounded border transition-all duration-150 cursor-pointer',
                          'text-muted-foreground border-border-subtle hover:bg-muted hover:text-foreground',
                        )}
                        onClick={() => appendReason(suggestion)}
                        title="Add as additional reason"
                      >
                        +Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom reason textarea */}
              <div className="space-y-1.5">
                <Label htmlFor="withdrawal-reject-reason">
                  Custom Reason <span className="text-muted-foreground/60 font-normal text-xs">(or write your own)</span>
                </Label>
                <textarea
                  ref={textareaRef}
                  id="withdrawal-reject-reason"
                  rows={4}
                  className={cn(
                    'w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-focus focus:border-focus',
                    'placeholder:text-muted-foreground',
                    error ? 'border-destructive focus:ring-destructive' : '',
                  )}
                  placeholder={
                    mode === 'fail'
                      ? 'Enter reason for marking transaction as failed…'
                      : 'Enter reason for rejection…'
                  }
                  value={reason}
                  maxLength={MAX_REASON_LENGTH}
                  onChange={(e) => {
                    setReason(e.target.value)
                    if (error) setError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleConfirm()
                    }
                  }}
                />
                <div className="flex justify-between items-center">
                  {error ? (
                    <div className="flex items-center gap-1.5 text-destructive text-xs">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {error}
                    </div>
                  ) : (
                    <span />
                  )}
                  <span
                    className={`text-xs ${reason.length > MAX_REASON_LENGTH ? 'text-destructive' : reason.length > MAX_REASON_LENGTH * 0.9 ? 'text-yellow-600' : 'text-muted-foreground'}`}
                  >
                    {reason.length}/{MAX_REASON_LENGTH}
                  </span>
                </div>
              </div>
            </>
          )}

          {mode === 'approve' && (
            <div className="space-y-1.5">
              <Label htmlFor="withdrawal-approve-note">
                Note <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="withdrawal-approve-note"
                rows={4}
                className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus focus:border-focus placeholder:text-muted-foreground"
                placeholder="Add an optional note for this approval…"
                value={reason}
                maxLength={MAX_REASON_LENGTH}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border-subtle shrink-0 gap-2">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button
            variant={mode === 'approve' ? 'success' : 'destructive'}
            onClick={handleConfirm}
          >
            {mode === 'approve' ? 'Approve Withdrawal' : mode === 'reject' ? 'Reject Withdrawal' : 'Mark Transaction as Failed'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}