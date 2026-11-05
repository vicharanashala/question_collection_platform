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
import { formatINRFull } from '@/lib/utils'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'

interface WalletAdjustModalProps {
  open: boolean
  userId: string
  userName: string
  currentBalance: number
  onClose: (newBalance?: number) => void
}

export function WalletAdjustModal({ open, userId, userName, currentBalance, onClose }: WalletAdjustModalProps) {
  const { t } = useTranslation()
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
      setError(t('walletAdjustModal.bothAmountAndReason'))
      return
    }
    const num = parseFloat(amount)
    if (isNaN(num) || num === 0) {
      setError(t('walletAdjustModal.enterNonZeroAmount'))
      return
    }
    setAdjusting(true)
    setError('')
    try {
      const res = await adminApi.adjustWallet(userId, { amount: num, reason: reason.trim() })
      toast.success(t('walletAdjustModal.walletAdjustedSuccessfully'))
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
          <DialogTitle className="flex items-center gap-2">{t('walletAdjustModal.adjustWalletBalance')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground mb-0.5">{t('walletAdjustModal.adjustingBalanceFor')}</p>
            <p className="font-semibold text-foreground">{userName}</p>
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground mt-1">
              Current balance:{' '}
              <span className="font-semibold tabular-nums">
                ₹{formatINRFull(Number(currentBalance))}
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
              placeholder={t('walletAdjustModal.500CreditOr200')}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError('') }}
              disabled={adjusting}
            />
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">{t('walletAdjustModal.positiveCreditToWallet')}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Input
              id="adj-reason"
              placeholder={t('walletAdjustModal.correctingErroneousRewardCredit')}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError('') }}
              disabled={adjusting}
            />
          </div>

          {error && (
            <p className="text-xs sm:text-xs sm:text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={handleClose} disabled={adjusting}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleAdjust} disabled={adjusting}>
            {adjusting ? t('walletAdjustModal.applying') : t('walletAdjustModal.applyAdjustment')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}