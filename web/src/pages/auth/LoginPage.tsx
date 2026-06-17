import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ShieldCheck, Loader2, ArrowLeft, CheckCircle, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

// ─── Resend countdown ──────────────────────────────────────────────────────

const RESEND_COOLDOWN = 30 // seconds

function useCountdown(initial = 0) {
  const [secs, setSecs] = useState(initial)
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = (from = RESEND_COOLDOWN) => {
    setSecs(from)
    setActive(true)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!)
          setActive(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setActive(false)
    setSecs(0)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  return { secs, active, start, stop }
}

// ─── Step indicator ────────────────────────────────────────────────────────

function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2].map((n) => (
        <div
          key={n}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            n === step ? 'w-5 bg-primary' : 'bg-text-tertiary/30',
          )}
        />
      ))}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [_sent, setSent] = useState(false)
  const countdown = useCountdown()

  const otpRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (step === 2) otpRef.current?.focus()
  }, [step])

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = mobile.replace(/\D/g, '').slice(0, 10)
    if (cleaned.length !== 10) {
      toast.error('Enter a valid 10-digit mobile number')
      return
    }
    setLoading(true)
    try {
      await authApi.requestOtp(cleaned, true)
      setSent(true)
      setStep(2)
      countdown.start()
      toast.success('OTP sent to your mobile')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send OTP'))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = otp.replace(/\D/g, '').slice(0, 6)
    if (cleaned.length !== 6) {
      toast.error('Enter the 6-digit OTP')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.verifyOtp(mobile, cleaned)

      if ('requiresRegistration' in res && res.requiresRegistration) {
        toast.error(`Account not registered. Role: ${res.role ?? 'USER'}`)
        return
      }

      const tokens = res.tokens!
      const user = res.user!

      login(
        { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
        { ...user, token: tokens.accessToken },
      )

      toast.success('Welcome back!')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Invalid OTP'))
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (countdown.active) return
    setOtp('')
    setLoading(true)
    try {
      await authApi.requestOtp(mobile, true)
      countdown.start()
      toast.success('New OTP sent')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to resend OTP'))
    } finally {
      setLoading(false)
    }
  }

  function handleBack() {
    setStep(1)
    setOtp('')
    countdown.stop()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">

      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-48 -top-48 h-[28rem] w-[28rem] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -left-32 -bottom-32 h-[22rem] w-[22rem] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-px w-96 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
        <div className="absolute left-1/2 bottom-0 h-px w-96 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      {/* Login card */}
      <Card className="relative w-full max-w-sm shadow-xl border-border-subtle">
        <CardHeader className="pb-4 text-center">
          {/* Logo mark */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 ring-4 ring-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight">Admin Portal</CardTitle>
          <CardDescription className="text-sm text-text-secondary px-2">
            Sign in to manage users, questions, and content
          </CardDescription>
          <div className="mt-4">
            <StepDots step={step} />
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          {step === 1 ? (
            // ── Step 1: Mobile number ────────────────────────────────────────
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">
                  Mobile Number
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center rounded-md border border-border-subtle bg-surface-variant px-3.5 text-sm font-semibold text-text-secondary shadow-xs">
                    +91
                  </div>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="98XXX XXXXX"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="flex-1 font-medium tracking-wide"
                    maxLength={10}
                    autoComplete="tel"
                  />
                </div>
                <p className="text-xs text-text-secondary">
                  We'll send a 6-digit OTP to this number
                </p>
              </div>

              <Button type="submit" className="w-full shadow-md" size="lg" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending OTP...</>
                ) : (
                  'Continue'
                )}
              </Button>
            </form>
          ) : (
            // ── Step 2: OTP ─────────────────────────────────────────────────
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              {/* Mobile indicator */}
              <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-variant/60 px-3 py-2">
                <Smartphone className="h-4 w-4 text-text-tertiary shrink-0" />
                <span className="text-sm font-medium text-text">+91 {mobile}</span>
                <button
                  type="button"
                  onClick={handleBack}
                  className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ArrowLeft className="h-3 w-3" /> Change
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">
                  One-Time Password
                </label>
                <Input
                  ref={otpRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="● ● ● ● ● ●"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-2xl tracking-[0.4em] font-mono font-bold py-6"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
                <p className="text-xs text-text-secondary text-center">
                  Enter the 6-digit code sent to your mobile
                </p>
              </div>

              <Button type="submit" className="w-full shadow-md" size="lg" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1 text-text-tertiary hover:text-text transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={countdown.active || loading}
                  className={cn(
                    'font-medium transition-colors',
                    countdown.active
                      ? 'text-text-tertiary cursor-not-allowed'
                      : 'text-primary hover:underline',
                  )}
                >
                  {countdown.active
                    ? `Resend in ${countdown.secs}s`
                    : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="absolute bottom-6 text-center">
        <p className="text-xs text-text-tertiary">
          Question Collection Platform &middot; Admin Dashboard
        </p>
      </div>
    </div>
  )
}