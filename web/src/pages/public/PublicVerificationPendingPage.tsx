import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation, Trans } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock, ShieldCheck, ArrowRight, Loader2, XCircle, PencilLine } from 'lucide-react'
import { authApi } from '@/api/client'
import { EditPublicProfileDialog } from '@/components/profile/EditPublicProfileDialog'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

/**
 * Shown while a public user waits for admin approval, and the only page such an
 * account can reach — `PublicRoute` redirects the rest of `/home` here until
 * `verificationStatus` is `verified`.
 *
 * Pressing the button calls /auth/me; the user is routed into the public app only
 * once the admin has verified them, otherwise they stay here.
 *
 * All UI text is translated via the i18n namespace `verificationPending.*`.
 * When the user picks a language in the profile-completion wizard's Step 4,
 * `useLanguage().setLanguage()` flips i18n's active language, which fires
 * `languageChanged` and re-renders this page in the chosen language.
 */
export function PublicVerificationPendingPage() {
  const navigate = useNavigate()
  const { user, updateUser, logout } = useAuth()
  const { t } = useTranslation()
  const [status, setStatus] = useState<string>(user?.verificationStatus ?? 'pending')
  const [rejectionReason, setRejectionReason] = useState<string | null>(
    user?.rejectionReason ?? null,
  )
  const [rejectedAt, setRejectedAt] = useState<string | null>(
    user?.rejectedAt ?? null,
  )
  const [checking, setChecking] = useState(false)
  const [editProfileOpen, setEditProfileOpen] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    if (user.role !== 'user') { navigate('/dashboard', { replace: true }); return }
    setStatus(user.verificationStatus ?? 'pending')
    setRejectionReason(user.rejectionReason ?? null)
    setRejectedAt(user.rejectedAt ?? null)
    if (user.verificationStatus === 'verified') { navigate('/home', { replace: true }) }
  }, [user, navigate])

  // Fetch the latest approval status and rejection reason on mount so updates show immediately.
  useEffect(() => {
    let cancelled = false
    authApi.me()
      .then(({ user: fresh }) => {
        if (cancelled) return
        updateUser(fresh)
        setStatus(fresh.verificationStatus ?? 'pending')
        setRejectionReason(fresh.rejectionReason ?? null)
        setRejectedAt(fresh.rejectedAt ?? null)
        if (fresh.verificationStatus === 'verified') {
          navigate('/home', { replace: true })
        }
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  /** Signs the pending account out so a different account can be used from this screen. */
  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  /** Re-reads the account from /auth/me and enters the app only once it is verified. */
  async function checkNow() {
    setChecking(true)
    try {
      const { user: fresh } = await authApi.me()
      updateUser(fresh)
      setStatus(fresh.verificationStatus ?? 'pending')
      setRejectionReason(fresh.rejectionReason ?? null)
      setRejectedAt(fresh.rejectedAt ?? null)
      if (fresh.verificationStatus === 'verified') {
        toast.success(t('verificationPending.toastVerified'))
        navigate('/home', { replace: true })
        return
      }
      if (fresh.verificationStatus === 'rejected') {
        toast.error('Your profile was rejected. Please review the reason and resubmit.')
        return
      }
      toast.info(t('verificationPending.statusNote'))
    } catch {
      toast.error(t('verificationPending.toastCheckFailed'))
    } finally {
      setChecking(false)
    }
  }

  const isRejected = status === 'rejected'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-amber-50/30 dark:from-emerald-950/40 dark:via-background dark:to-amber-950/20 p-4">
      <div className="w-full max-w-md rounded-xl border border-border-subtle bg-white shadow-md p-6 sm:p-8 text-center dark:bg-surface">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-4 ${
            isRejected
              ? 'bg-rose-100 dark:bg-rose-950/40'
              : 'bg-emerald-100 dark:bg-emerald-950/40'
          }`}
        >
          {isRejected ? (
            <XCircle className="h-8 w-8 text-rose-600 dark:text-rose-400" />
          ) : (
            <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">
          {isRejected ? 'Profile Rejected' : t('verificationPending.welcomeHeading')}
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-text-secondary">
          {isRejected
            ? 'Your profile needs updates before it can be approved. Please review the feedback below and resubmit.'
            : t('verificationPending.subtitle')}
        </p>

        {isRejected ? (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50/70 p-4 text-left dark:border-rose-900/50 dark:bg-rose-950/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
              Rejection Reason
            </p>
            <p className="mt-1.5 text-sm font-medium text-foreground">
              {rejectionReason || 'No reason provided. Please review your profile details and resubmit.'}
            </p>
            {rejectedAt && (
              <p className="mt-2 text-[11px] text-text-tertiary">
                Rejected on {formatDate(rejectedAt)}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 text-left">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-foreground">{t('verificationPending.accountCreated')}</p>
                <p className="text-[11px] sm:text-xs text-text-secondary">{t('verificationPending.detailsSaved')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs sm:text-sm font-semibold text-foreground">{t('verificationPending.pendingCardTitle')}</p>
                <p className="text-[11px] sm:text-xs text-text-secondary">{t('verificationPending.pendingCardHint')}</p>
              </div>
            </div>
          </div>
        )}

        <p className="mt-4 text-[11px] sm:text-xs text-text-tertiary">
          <Trans
            i18nKey="verificationPending.currentStatus"
            values={{ status }}
            components={{ bold: <span className="font-semibold capitalize" /> }}
          />
        </p>

        {isRejected && user && (
          <Button
            onClick={() => setEditProfileOpen(true)}
            className="mt-5 w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <PencilLine className="h-4 w-4" />
            Update Profile &amp; Resubmit
          </Button>
        )}

        <Button
          onClick={checkNow}
          disabled={checking}
          variant={isRejected ? 'outline' : 'default'}
          className={isRejected ? 'mt-2.5 w-full' : 'mt-5 w-full bg-emerald-500 hover:bg-emerald-600'}
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {checking
            ? t('verificationPending.checkingStatus')
            : t('verificationPending.checkStatus')}
        </Button>

        <Button
          variant="ghost"
          onClick={handleLogout}
          className="mt-2 w-full text-xs text-text-secondary sm:text-sm"
        >
          {t('verificationPending.logout')}
        </Button>
      </div>

      {user && (
        <EditPublicProfileDialog
          open={editProfileOpen}
          onOpenChange={setEditProfileOpen}
          user={user}
          resubmitMode
          onSaved={(updatedUser) => {
            updateUser(updatedUser)
            setStatus(updatedUser.verificationStatus ?? 'pending')
            setRejectionReason(updatedUser.rejectionReason ?? null)
            setRejectedAt(updatedUser.rejectedAt ?? null)
          }}
        />
      )}
    </div>
  )
}