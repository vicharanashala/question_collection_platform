/**
 * WalletAdjustModal — a standalone dialog for manually adjusting a user's wallet balance.
 * Opened from WalletDetailModal.
 */
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminApi, getErrorMessage } from '@/api/client'
import { toast } from 'sonner'

interface WalletAdjustModalProps {
  open: boolean
  userId: string
  userName: string
  currentBalance: number
  onClose: (newBalance?: number) => void
}

export function WalletAdjustModal({ open, userId, userName, currentBalance, onClose }: WalletAdjustModalProps) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setAmount('')
    setReason('')
    setError('')
    setAdjusting(false)
  }

  function handleClose() {
    if (adjusting) return
    reset()
    onClose()
  }

  async function handleAdjust() {
    if (!amount || !reason.trim()) {
      setError('Both amount and reason are required')
      return
    }
    const num = parseFloat(amount)
    if (isNaN(num) || num === 0) {
      setError('Enter a non-zero amount (positive = credit, negative = debit)')
      return
    }
    setAdjusting(true)
    setError('')
    try {
      const res = await adminApi.adjustWallet(userId, { amount: num, reason: reason.trim() })
      toast.success('Wallet adjusted successfully')
      reset()
      onClose(res.newBalance)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to adjust wallet'))
      setAdjusting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Adjust Wallet Balance
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-xs text-muted-foreground mb-0.5">Adjusting balance for</p>
            <p className="font-semibold text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Current balance:{' '}
              <span className="font-semibold tabular-nums">
                ₹{Number(currentBalance).toLocaleString('en-IN')}
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-amount">
              Amount <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adj-amount"
              type="number"
              step="0.01"
              placeholder="e.g. 500 (credit) or -200 (debit)"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError('') }}
              disabled={adjusting}
            />
            <p className="text-xs text-muted-foreground">
              Positive = credit to wallet, Negative = debit from wallet
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adj-reason"
              placeholder="e.g. Correcting erroneous reward credit"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError('') }}
              disabled={adjusting}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={adjusting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleAdjust} disabled={adjusting}>
            {adjusting ? 'Applying…' : 'Apply Adjustment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}