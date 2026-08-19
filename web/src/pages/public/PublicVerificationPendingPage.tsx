import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Clock, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react'
import { authApi } from '@/api/client'
import { toast } from 'sonner'

/**
 * Shown immediately after a public user successfully registers.
 * The backend sets `verificationStatus = 'pending'` for new users.
 * Pressing "Continue" calls /auth/me; if the curator has already verified
 * the user we route them into the public app, otherwise we let them in
 * with the still-pending status (questions can still be submitted).
 */
export function PublicVerificationPendingPage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()
  const [status, setStatus] = useState<string>(user?.verificationStatus ?? 'pending')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login', { replace: true }); return }
    if (user.role !== 'user') { navigate('/dashboard', { replace: true }); return }
  }, [user, navigate])

  async function checkNow() {
    setChecking(true)
    try {
      const { user: fresh } = await authApi.me()
      updateUser(fresh)
      setStatus(fresh.verificationStatus ?? 'pending')
      if (fresh.verificationStatus === 'verified') {
        toast.success('You are verified! Welcome to AnnaDatha.')
      }
      navigate('/home', { replace: true })
    } catch {
      toast.error('Could not check status. Please try again.')
      // Still let them in — the dashboard will just show pending state.
      navigate('/home', { replace: true })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-amber-50/30 dark:from-emerald-950/40 dark:via-background dark:to-amber-950/20 p-4">
      <div className="w-full max-w-md rounded-xl border border-border-subtle bg-white shadow-md p-6 sm:p-8 text-center dark:bg-surface">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/40 mx-auto mb-4">
          <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground">You're almost there!</h1>
        <p className="mt-2 text-xs sm:text-xs sm:text-sm text-text-secondary">
          Your account has been created. A curator will review your details and verify you within 24–48 hours.
          You can already explore the app and submit a question.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 text-left">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground">Account created</p>
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">Your details are saved.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground">Verification pending</p>
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">A curator will review your profile soon.</p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">Current status: <span className="font-semibold capitalize">{status}</span></p>

        <Button onClick={checkNow} disabled={checking} className="mt-5 w-full bg-emerald-500 hover:bg-emerald-600">
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {checking ? 'Checking…' : 'Continue to AnnaDatha'}
        </Button>
      </div>
    </div>
  )
}