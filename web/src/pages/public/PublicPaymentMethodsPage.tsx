/**
 * Public Payment Methods Page — mirrors
 * mobile/src/screens/Wallet/PaymentDetailsScreen.tsx
 *
 * Layout matches the mobile screenshots:
 *   • Header: back arrow · "Payment Methods" · + (or X in add mode)
 *   • Teal info banner: "Payment methods are verified with a ₹1
 *     micro-transaction before use."
 *   • Empty state: wallet icon + "No payment methods" + helper text
 *   • Add Payment Method panel (toggle UPI / Bank Account) with the same
 *     fields and validation as mobile
 *
 * Web caveat: the native Razorpay SDK is required to complete the ₹1
 * micro-transaction verification. On submission we call the backend to
 * create the payment detail, then surface a clear notice that the user
 * must complete verification in the mobile app.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { walletApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, X, Shield, Wallet,
  AtSign, Building2, Loader2, AlertCircle, CheckCircle2,
  Clock, Smartphone, Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'

// ─── Types & helpers ────────────────────────────────────────────────────────

type PaymentDetailStatus = 'pending' | 'in_progress' | 'verified' | 'failed'

interface PaymentDetail {
  id: string
  payoutMethod: 'upi' | 'bank_transfer'
  status: PaymentDetailStatus
  displayValue: string
  bankName: string | null
  ifsc: string | null
  accountHolderName: string | null
  verifiedAt: string | null
  createdAt: string
}

const STATUS_CONFIG: Record<PaymentDetailStatus, { labelKey: string; cls: string; icon: ReactNode }> = {
  verified:    { labelKey: 'status.verified',              cls: 'bg-success/12 text-success',     icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  in_progress: { labelKey: 'paymentMethods.statusInProgress', cls: 'bg-warning/12 text-warning',     icon: <Clock className="h-3.5 w-3.5" /> },
  pending:     { labelKey: 'status.pending',               cls: 'bg-muted text-text-tertiary',    icon: <Clock className="h-3.5 w-3.5" /> },
  failed:      { labelKey: 'paymentMethods.statusFailed',  cls: 'bg-destructive/12 text-destructive', icon: <AlertCircle className="h-3.5 w-3.5" /> },
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

// Validation regexes mirror mobile/src/screens/Wallet/PaymentDetailsScreen.tsx
const RE_UPI   = /^[a-zA-Z0-9.\-_]{2,50}@[a-zA-Z0-9]{2,15}$/
const RE_ACCT  = /^\d{9,18}$/
const RE_IFSC  = /^[A-Z]{4}0[A-Z0-9]{6}$/

// _CHUNK_1_END

// ─── Add Payment Method form ─────────────────────────────────────────────────

interface AddPaymentFormProps {
  onSuccess: () => void
  onCancel: () => void
}

function AddPaymentForm({ onSuccess, onCancel }: AddPaymentFormProps) {
  const { t } = useTranslation()
  const [payoutMethod, setPayoutMethod] = useState<'upi' | 'bank_transfer'>('upi')
  const [upiId, setUpiId] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [bankName, setBankName] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setUpiId('')
    setAccountNumber('')
    setConfirmAccountNumber('')
    setIfsc('')
    setAccountHolderName('')
    setBankName('')
    setFormError('')
    setPayoutMethod('upi')
  }

  function validate(): boolean {
    if (payoutMethod === 'upi') {
      if (!upiId || !RE_UPI.test(upiId)) {
        setFormError(t('wallet.enterUpiId'))
        return false
      }
    } else {
      if (!accountNumber || !RE_ACCT.test(accountNumber)) {
        setFormError(t('paymentMethods.errors.invalidAccountNumber'))
        return false
      }
      if (accountNumber !== confirmAccountNumber) {
        setFormError(t('paymentMethods.errors.accountMismatch'))
        return false
      }
      if (!ifsc || !RE_IFSC.test(ifsc.toUpperCase())) {
        setFormError(t('paymentMethods.errors.invalidIfsc'))
        return false
      }
      if (!accountHolderName || accountHolderName.trim().length < 2) {
        setFormError(t('paymentMethods.errors.missingHolderName'))
        return false
      }
    }
    setFormError('')
    return true
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    try {
      const data = payoutMethod === 'upi'
        ? { payoutMethod, upiId: upiId.trim() }
        : {
            payoutMethod,
            accountNumber: accountNumber.trim(),
            confirmAccountNumber: confirmAccountNumber.trim(),
            ifsc: ifsc.trim().toUpperCase(),
            accountHolderName: accountHolderName.trim(),
            bankName: bankName.trim() || undefined,
          }
      const res = await walletApi.addPaymentDetail(data)
      toast.success(res.message ?? t('paymentMethods.toastAdded'))
      reset()
      onSuccess()
    } catch (e) {
      setFormError(getErrorMessage(e, t('paymentMethods.toastAddError')))
    } finally {
      setSubmitting(false)
    }
  }

// _CHUNK_2a_END

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h2 className="text-base sm:text-base sm:text-lg font-bold text-foreground">{t('paymentMethods.addFormTitle')}</h2>

        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setPayoutMethod('upi'); setFormError('') }}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-xs sm:text-sm font-semibold transition-colors',
              payoutMethod === 'upi'
                ? 'border-primary bg-primary/8 text-primary'
                : 'border-border-subtle bg-surface text-text-secondary hover:bg-muted',
            )}
          >
            <AtSign className="h-4 w-4" /> {t('wallet.upiTab')}
          </button>
          <button
            type="button"
            onClick={() => { setPayoutMethod('bank_transfer'); setFormError('') }}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg border px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-xs sm:text-sm font-semibold transition-colors',
              payoutMethod === 'bank_transfer'
                ? 'border-primary bg-primary/8 text-primary'
                : 'border-border-subtle bg-surface text-text-secondary hover:bg-muted',
            )}
          >
            <Building2 className="h-4 w-4" /> {t('wallet.bankTab')}
          </button>
        </div>

        {/* Fields */}
        {payoutMethod === 'upi' ? (
          <div className="space-y-1.5">
            <Label htmlFor="pm-upi" className="sr-only">UPI ID</Label>
            <Input
              id="pm-upi"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder={t('wallet.upiIdPlaceholder')}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-12"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pm-acct" className="sr-only">Account number</Label>
              <Input
                id="pm-acct"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                placeholder={t('wallet.accountNumber')}
                inputMode="numeric"
                className="h-12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-acct2" className="sr-only">Confirm account number</Label>
              <Input
                id="pm-acct2"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))}
                placeholder={t('paymentMethods.confirmAccountNumberPlaceholder')}
                inputMode="numeric"
                className="h-12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-ifsc" className="sr-only">IFSC code</Label>
              <Input
                id="pm-ifsc"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                placeholder={`${t('wallet.ifscCode')} (${t('wallet.ifscCodePlaceholder')})`}
                maxLength={11}
                autoCapitalize="characters"
                className="h-12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-holder" className="sr-only">Account holder name</Label>
              <Input
                id="pm-holder"
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder={t('wallet.accountHolderName')}
                className="h-12"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-bank" className="sr-only">Bank name (optional)</Label>
              <Input
                id="pm-bank"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder={t('paymentMethods.bankNamePlaceholder')}
                className="h-12"
              />
            </div>
          </div>
        )}

        {formError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/8 p-2.5 text-[11px] sm:text-[11px] sm:text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{formError}</p>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="h-12 w-full bg-emerald-500 text-sm sm:text-sm sm:text-base font-semibold hover:bg-emerald-600"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('paymentMethods.addAndVerify')}
        </Button>

        <p className="text-center text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">
          {t('paymentMethods.verificationChargeNote')}
        </p>

        <Button variant="ghost" size="sm" onClick={() => { reset(); onCancel() }} className="w-full">
          {t('editProfile.cancel')}
        </Button>
      </CardContent>
    </Card>
  )
}

// _CHUNK_2b_END

// ─── Saved payment method card ───────────────────────────────────────────────

interface SavedItemProps {
  detail: PaymentDetail
  onDelete: (id: string) => void
}
function SavedItem({ detail, onDelete }: SavedItemProps) {
  const { t } = useTranslation()
  const cfg = STATUS_CONFIG[detail.status] ?? STATUS_CONFIG.pending
  const isUpi = detail.payoutMethod === 'upi'
  const canDelete = detail.status !== 'in_progress'

  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          isUpi ? 'bg-primary/12 text-primary' : 'bg-violet-500/12 text-violet-700',
        )}>
          {isUpi ? <AtSign className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs sm:text-xs sm:text-sm font-bold text-foreground">
                {isUpi
                  ? detail.displayValue
                  : `A/c ${detail.displayValue}${detail.bankName ? ` · ${detail.bankName}` : ''}`}
              </p>
              <p className="mt-0.5 truncate text-[10px] sm:text-[11px] sm:text-xs text-text-secondary">
                {isUpi ? t('wallet.upiTab') : t('wallet.withdrawal.bank')}
                {detail.accountHolderName && ` · ${detail.accountHolderName}`}
              </p>
              {!isUpi && detail.ifsc && (
                <p className="mt-0.5 font-mono text-[9px] sm:text-[10px] text-text-tertiary">IFSC {detail.ifsc}</p>
              )}
            </div>
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider', cfg.cls)}>
              {cfg.icon}
              {t(cfg.labelKey)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[9px] sm:text-[10px] text-text-tertiary">
              {detail.status === 'verified' && detail.verifiedAt
                ? t('paymentMethods.verifiedOn', { date: formatDate(detail.verifiedAt) })
                : t('paymentMethods.addedOn', { date: formatDate(detail.createdAt) })}
            </p>
            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(detail.id)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold text-destructive transition-colors hover:bg-destructive/10"
                aria-label="Remove"
              >
                <Trash2 className="h-3 w-3" />
                {t('paymentMethods.remove')}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

// _CHUNK_3_END

// ─── Main page ───────────────────────────────────────────────────────────────

export function PublicPaymentMethodsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [details, setDetails] = useState<PaymentDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchDetails = useCallback(async () => {
    setLoading(true)
    try {
      const res = await walletApi.getPaymentDetails()
      setDetails(Array.isArray(res) ? (res as PaymentDetail[]) : [])
    } catch (err) {
      toast.error(getErrorMessage(err, t('paymentMethods.toastLoadError')))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDetails() }, [fetchDetails])

  async function onDelete(id: string) {
    setDeleting(true)
    try {
      await walletApi.deletePaymentDetail(id)
      toast.success(t('paymentMethods.toastRemoved'))
      setConfirmDelete(null)
      await fetchDetails()
    } catch (err) {
      toast.error(getErrorMessage(err, t('paymentMethods.toastRemoveError')))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg sm:text-xl font-bold text-foreground lg:text-2xl">{t('profile.paymentMethods')}</h1>
        </div>
        <Button
          variant={mode === 'add' ? 'outline' : 'default'}
          onClick={() => setMode((m) => (m === 'list' ? 'add' : 'list'))}
          className={mode === 'add' ? '' : 'bg-emerald-500 hover:bg-emerald-600'}
        >
          {mode === 'add' ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {mode === 'add' ? t('common.close', 'Close') : t('paymentMethods.addButton')}
        </Button>
      </div>

      {/* ── Info banner ─────────────────────────────────────────── */}
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs sm:text-xs sm:text-sm text-text-secondary dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <p>{t('paymentMethods.verifyBanner')}</p>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
        </div>
      ) : mode === 'add' ? (
        <AddPaymentForm
          onSuccess={() => { setMode('list'); fetchDetails() }}
          onCancel={() => setMode('list')}
        />
      ) : details.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted text-text-tertiary">
            <Wallet className="h-10 w-10" strokeWidth={1.5} />
          </div>
          <p className="mt-5 text-base sm:text-base sm:text-lg font-bold text-foreground">{t('paymentMethods.emptyTitle')}</p>
          <p className="mt-1 text-xs sm:text-xs sm:text-sm text-text-secondary">
            {t('paymentMethods.emptySubtitle')}
          </p>
          <Button
            onClick={() => setMode('add')}
            className="mt-6 bg-emerald-500 hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4" />
            {t('paymentMethods.addButton')}
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border-subtle">
              {details.map((d) => (
                <SavedItem key={d.id} detail={d} onDelete={(id) => setConfirmDelete(id)} />
              ))}
            </ul>
            <div className="border-t border-border-subtle p-3">
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-[11px] sm:text-[11px] sm:text-xs text-text-secondary dark:border-amber-900/40 dark:bg-amber-950/20">
                <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                <p className="text-[11px] sm:text-[11px] sm:text-xs">{t('paymentMethods.mobileVerificationNote')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border-subtle bg-white p-5 shadow-xl dark:bg-surface">
            <h3 className="text-sm sm:text-sm sm:text-base font-bold text-foreground">{t('paymentMethods.confirmRemoveTitle')}</h3>
            <p className="mt-1.5 text-xs sm:text-xs sm:text-sm text-text-secondary">
              {t('paymentMethods.confirmRemoveMessage')}
            </p>
            <div className="mt-3 sm:mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)} disabled={deleting}>
                {t('editProfile.cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(confirmDelete)}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {t('paymentMethods.remove')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PublicPaymentMethodsPage

