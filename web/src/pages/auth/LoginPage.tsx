import { useState, useEffect, useRef, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { authApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Loader2,
  ArrowLeft,
  CheckCircle,
  Smartphone,
  MicVocal,
  Languages,
  Wallet,
  BookOpen,
  Sun,
  Moon,
} from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { LegalDocumentModal } from '@/components/ui/legal-document-modal'
import { toast } from 'sonner'

// ─── Resend countdown ──────────────────────────────────────────────────────

const RESEND_COOLDOWN = 30

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

// ─── Decorative orb ────────────────────────────────────────────────────────

function Orb({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'absolute rounded-full bg-[hsl(var(--primary))]/10 blur-3xl pointer-events-none',
        className,
      )}
    />
  )
}

// ─── Branding panel features ───────────────────────────────────────────────

const FEATURES = [
  {
    icon: MicVocal,
    heading: 'Voice & Text Questions',
    body: 'Ask in your own language — Hindi, Tamil, Telugu, and 16 more Indian languages.',
  },
  {
    icon: Wallet,
    heading: 'Earn Rewards',
    body: 'Get points for every approved question. Withdraw earnings via UPI or bank.',
  },
  {
    icon: BookOpen,
    heading: 'Expert Answers',
    body: 'Curated FAQ knowledge base built by agricultural experts and community moderators.',
  },
  {
    icon: Languages,
    heading: '19 Indian Languages',
    body: 'Full support for Assamese, Bengali, Gujarati, Kannada, Malayalam, Marathi, Odia, Punjabi, Tamil, Telugu, and more.',
  },
]

// ─── Step 1: Mobile number ─────────────────────────────────────────────────

function StepMobile({
  mobile,
  setMobile,
  loading,
  onSubmit,
}: {
  mobile: string
  setMobile: (v: string) => void
  loading: boolean
  onSubmit: (e: React.FormEvent) => void
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs sm:text-sm font-medium text-[hsl(var(--text))]">
          Mobile Number
        </label>
        <div className="flex gap-1.5 sm:gap-2">
          <div className="flex items-center rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-variant))] px-3 sm:px-4 text-sm font-semibold text-[hsl(var(--text-secondary))]">
            +91
          </div>
          <Input
            type="tel"
            inputMode="tel"
            placeholder="10-digit number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="flex-1 text-sm sm:text-base font-medium"
            maxLength={10}
            autoComplete="tel"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? (
          <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending OTP...</>
        ) : (
          'Send OTP'
        )}
      </Button>

      <p className="text-center text-[11px] sm:text-xs text-[hsl(var(--text-tertiary))]">
        A 6-digit code will be sent to your mobile
      </p>
    </form>
  )
}

// ─── Step 2: OTP ───────────────────────────────────────────────────────────

function StepOtp({
  mobile,
  otp,
  setOtp,
  loading,
  countdown,
  onSubmit,
  onBack,
  onResend,
}: {
  mobile: string
  otp: string
  setOtp: (v: string) => void
  loading: boolean
  countdown: ReturnType<typeof useCountdown>
  onSubmit: (e: React.FormEvent) => void
  onBack: () => void
  onResend: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace' && otp[idx] === '' && idx > 0) {
      // Move focus to previous box when backspacing an empty box
      const prev = inputRef.current?.parentElement?.children[idx - 1] as HTMLInputElement | undefined
      prev?.focus()
    }
  }

  const digits = otp.padEnd(6, ' ').split('')

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Mobile badge */}
      <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-variant))] px-3 py-2.5">
        <Smartphone className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />
        <span className="text-xs font-medium text-[hsl(var(--text))] flex-1">+91 {mobile}</span>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-[hsl(var(--primary))] hover:underline shrink-0"
        >
          <ArrowLeft className="h-3 w-3" /> Change
        </button>
      </div>

      {/* OTP boxes */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[hsl(var(--text))]">
          One-Time Password
        </label>
        <div className="flex gap-1.5 justify-center">
          {digits.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => inputRef.current?.focus()}
              className={cn(
                'flex h-10 w-9 items-center justify-center rounded-lg border text-lg font-bold font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-1',
                d && d !== ' '
                  ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 text-[hsl(var(--text))]'
                  : 'border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface))] text-[hsl(var(--text-tertiary))]',
              )}
            >
              {d && d !== ' ' ? d : ''}
            </button>
          ))}
        </div>
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          name="otp"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => {
            const idx = otp.length
            handleKeyDown(e as unknown as KeyboardEvent<HTMLInputElement>, idx)
          }}
          autoComplete="one-time-code"
          className="sr-only"
          maxLength={6}
        />
        <p className="text-[11px] text-[hsl(var(--text-tertiary))] text-center">
          Enter the 6-digit code sent to your mobile
        </p>
      </div>

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={loading || otp.length < 6}
      >
        {loading ? (
          <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Verifying...</>
        ) : (
          <><CheckCircle className="mr-1.5 h-4 w-4" /> Verify & Sign In</>
        )}
      </Button>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onResend}
          disabled={countdown.active || loading}
          className={cn(
            'text-xs sm:text-sm font-medium transition-colors',
            countdown.active
              ? 'text-[hsl(var(--text-tertiary))] cursor-not-allowed'
              : 'text-[hsl(var(--primary))] hover:underline',
          )}
        >
          {countdown.active
            ? `Resend in ${countdown.secs}s`
            : "Didn't receive it? Resend"}
        </button>
      </div>
    </form>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [step, setStep] = useState<1 | 2>(1)
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const countdown = useCountdown()
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null)

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = mobile.replace(/\D/g, '').slice(0, 10)
    if (cleaned.length !== 10) {
      toast.error('Enter a valid 10-digit mobile number')
      return
    }
    setLoading(true)
    try {
      await authApi.requestOtp(cleaned, false)
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
        if (res.role === 'user') {
          navigate('/home', { state: { mobileNumber: mobile }, replace: true })
        } else {
          toast.error('Your account is not yet activated. Please contact your administrator.')
        }
        return
      }

      const tokens = res.tokens!
      const user = res.user!
      login(
        { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
        { ...user, token: tokens.accessToken },
      )

      if (user.role === 'user') {
        toast.success('Welcome back!')
        navigate('/home', { replace: true })
      } else {
        toast.success('Welcome back!')
        navigate('/dashboard', { replace: true })
      }
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
    <div className="relative flex h-screen w-screen overflow-hidden bg-background">

      {/* ── Theme toggle — fixed top right of the entire page ─────────── */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        className="fixed top-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--text-secondary))] transition-colors hover:bg-[hsl(var(--surface-variant))] hover:text-[hsl(var(--text))]"
      >
        {theme === 'light' ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>

      {/* ── Left branding panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex relative flex-col justify-between shrink-0 w-[46%] max-w-[480px] overflow-hidden bg-[hsl(var(--primary))] px-10 py-12 xl:px-14">

        {/* Top: logo + brand name */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/15 p-2">
            <BrandLogo className="h-full w-full" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
              AnnaDatha
            </h1>
            <p className="text-white/60 text-sm">Farming Questions Platform</p>
          </div>
        </div>

        {/* Centre: 4 feature bullets, clean and well-spaced */}
        <div className="flex flex-col justify-center flex-1 py-10">
          <ul className="space-y-6">
            {FEATURES.map(({ icon: Icon, heading, body }) => (
              <li key={heading} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">{heading}</p>
                  <p className="mt-0.5 text-xs text-white/55 leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: simple footer */}
        <p className="text-xs text-white/30">
          &copy; {new Date().getFullYear()} AnnaDatha
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 relative overflow-hidden">

        {/* Background gradient orbs — mobile only */}
        <Orb className="-right-20 -top-24 w-[340px] h-[340px] lg:hidden opacity-50" />
        <Orb className="-left-16 bottom-0 w-[260px] h-[260px] lg:hidden opacity-50" />

        <div className="relative z-10 w-full max-w-sm">

          {/* ── Mobile card ── */}
          <Card className="w-full overflow-hidden shadow-lg border border-[hsl(var(--border-subtle))]">

            {/* Card header — logo + title + tagline */}
            <div className="flex flex-col items-center px-6 pt-7 pb-5 bg-[hsl(var(--primary))]">
              <div className="mb-2.5 h-14 w-14 rounded-2xl bg-white/20 p-2 shadow-sm">
                <BrandLogo className="h-full w-full" />
              </div>
              <h1 className="text-lg font-extrabold text-white tracking-tight">
                AnnaDatha
              </h1>
              <p className="mt-0.5 text-xs text-white/70">
                Farming Questions Platform
              </p>
            </div>

            {/* Card body — form */}
            <div className="px-6 py-5">

              {/* Step heading */}
              <div className="mb-4">
                <h2 className="text-xl font-bold text-[hsl(var(--text))]">
                  {step === 1 ? 'Sign in' : 'Verify OTP'}
                </h2>
                <p className="mt-0.5 text-xs text-[hsl(var(--text-secondary))]">
                  {step === 1
                    ? 'Enter your mobile number to continue'
                    : `OTP sent to +91 ${mobile}`}
                </p>
              </div>

              {/* Animated step forms */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.14 }}
                >
                  {step === 1 ? (
                    <StepMobile
                      mobile={mobile}
                      setMobile={setMobile}
                      loading={loading}
                      onSubmit={handleSendOtp}
                    />
                  ) : (
                    <StepOtp
                      mobile={mobile}
                      otp={otp}
                      setOtp={setOtp}
                      loading={loading}
                      countdown={countdown}
                      onSubmit={handleVerifyOtp}
                      onBack={handleBack}
                      onResend={handleResend}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Legal */}
              <p className="mt-4 text-center text-[10px] text-[hsl(var(--text-tertiary))]">
                By continuing, you agree to our{' '}
                <button
                  type="button"
                  onClick={() => setLegalDoc('terms')}
                  className="underline hover:text-[hsl(var(--text-secondary))]"
                >
                  Terms
                </button>
                {' '}and{' '}
                <button
                  type="button"
                  onClick={() => setLegalDoc('privacy')}
                  className="underline hover:text-[hsl(var(--text-secondary))]"
                >
                  Privacy Policy
                </button>
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Legal document modals */}
      <LegalDocumentModal
        type={legalDoc ?? 'terms'}
        open={legalDoc !== null}
        onOpenChange={(open) => !open && setLegalDoc(null)}
      />

    </div>
  )
}