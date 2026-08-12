import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { adminApi, questionApi, walletApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  FileText, BookOpen, User, MessageSquare, Sparkles, TrendingUp, Wallet,
  Trophy, Calendar, PenLine, Lightbulb, ArrowRight, Info, Leaf,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'
import { REWARD_TIERS } from '@/constants/public'

interface MyStats { totalQuestions?: number; totalApproved?: number; totalAnswers?: number }

interface PublicActionCardProps {
  icon: ReactNode
  label: string
  subtitle: string
  onClick: () => void
  color: 'emerald' | 'blue' | 'violet' | 'amber'
}

function PublicActionCard({ icon, label, subtitle, onClick, color }: PublicActionCardProps) {
  const palettes: Record<typeof color, string> = {
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-100 text-emerald-700',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-100 text-blue-700',
    violet: 'from-violet-500/15 to-violet-500/5 border-violet-100 text-violet-700',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-100 text-amber-700',
  }
  const textColor = palettes[color].split(' ').pop() ?? 'text-emerald-700'
  return (
    <button onClick={onClick} className={cn('rounded-xl border bg-gradient-to-br p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5', palettes[color])}>
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-white/80', textColor)}>{icon}</div>
      <p className="mt-3 text-sm font-bold text-foreground">{label}</p>
      <p className="text-xs text-text-secondary">{subtitle}</p>
    </button>
  )
}

interface InfoTipProps {
  label: string
  description: string
}

function InfoTip({ label, description }: InfoTipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex items-center justify-center text-text-tertiary transition-colors hover:text-text-secondary"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  )
}

// Tier display config — mirrors the visual style on mobile (Bronze → Silver → Gold).
// Source-of-truth ranges live in REWARD_TIERS; this is presentation only.
const TIER_DISPLAY = [
  { key: 'bronze', label: 'Bronze', bg: 'bg-orange-600', text: 'text-orange-600', track: 'bg-orange-600' },
  { key: 'silver', label: 'Silver', bg: 'bg-slate-400', text: 'text-slate-500',  track: 'bg-slate-400' },
  { key: 'gold',   label: 'Gold',   bg: 'bg-amber-500', text: 'text-amber-500',  track: 'bg-amber-500' },
] as const

export function PublicHomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [stats, setStats] = useState<MyStats | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [dailyLimit, setDailyLimit] = useState<number>(20)
  const [editWindowSec, setEditWindowSec] = useState<number>(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.allSettled([questionApi.getMyStats(), walletApi.getBalance()])
      .then(([s, w]) => {
        if (!alive) return
        if (s.status === 'fulfilled') {
          setStats(s.value)
          setDailyLimit((s.value as { dailyLimit?: number }).dailyLimit ?? 20)
        }
        if (w.status === 'fulfilled') setBalance(w.value.balance ?? 0)
      })
      .catch((e) => console.warn(getErrorMessage(e, 'home load')))
      .finally(() => { if (alive) setLoading(false) })

    // Try to read the configured edit-window length so the tip row matches
    // what staff have set. The endpoint is admin-scoped, so a public user
    // gets a 403 and we fall back to "closed" (matches the screenshot).
    adminApi.getConfig()
      .then((res) => {
        if (!alive) return
        const found = (res.items ?? []).find((c) => c.key === 'question_edit_window_seconds')
        setEditWindowSec(found?.value ?? 0)
      })
      .catch(() => { /* public users can't read admin config — default 0 */ })

    return () => { alive = false }
  }, [])

  const approved = stats?.totalApproved ?? 0
  const currentTier = REWARD_TIERS.find((t) => approved >= t.min && approved <= t.max) ?? REWARD_TIERS[0]
  const nextTier = REWARD_TIERS.find((t) => t.min > approved)
  const progressToNext = nextTier ? Math.min(100, Math.round(((approved - currentTier.min + 1) / (nextTier.min - currentTier.min)) * 100)) : 100
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' })()
  const name = user?.name?.split(' ')[0] || 'Friend'

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="border-emerald-100 bg-gradient-to-br from-emerald-500/8 via-emerald-500/3 to-transparent dark:border-emerald-900/40">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{greeting}</p>
              <h1 className="mt-1 truncate text-2xl font-bold text-foreground">{name} 🙏</h1>
              <p className="mt-1 text-sm text-text-secondary">What can we help you grow today?</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-2xl">🌾</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700"><Wallet className="h-5 w-5" /></div>
              <div>
                <p className="text-xs text-text-tertiary">Wallet Balance</p>
                <p className="text-lg font-bold text-foreground">₹{loading ? '…' : balance.toFixed(0)}</p>
              </div>
            </div>
            <Link to="/public/profile" className="text-xs font-medium text-emerald-700 hover:underline">View</Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <PublicActionCard color="emerald" icon={<MessageSquare className="h-5 w-5" />} label="Ask a Question" subtitle="Get expert answers" onClick={() => navigate('/public/ask')} />
        <PublicActionCard color="blue" icon={<FileText className="h-5 w-5" />} label="My Questions" subtitle={`${stats?.totalQuestions ?? 0} asked`} onClick={() => navigate('/public/questions')} />
        <PublicActionCard color="violet" icon={<BookOpen className="h-5 w-5" />} label="Help & FAQ" subtitle="Browse articles" onClick={() => navigate('/public/faqs')} />
        <PublicActionCard color="amber" icon={<User className="h-5 w-5" />} label="Profile" subtitle="Account settings" onClick={() => navigate('/public/profile')} />
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">Reward Tier</p>
              <p className="mt-1 text-lg font-bold text-foreground flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-amber-500" />{currentTier.reward} pts per answer</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-tertiary">Approved</p>
              <p className="text-2xl font-bold text-foreground">{loading ? '…' : approved}</p>
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-text-tertiary">
              <span>Tier {REWARD_TIERS.indexOf(currentTier) + 1} of {REWARD_TIERS.length}</span>
              {nextTier && <span>{nextTier.min - approved} to next tier → ₹{nextTier.reward}/answer</span>}
              {!nextTier && <span className="text-emerald-700 font-semibold">Top tier reached 🎉</span>}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/30">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressToNext}%` }} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-bold text-foreground flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-emerald-600" />Your activity</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-950/20"><p className="text-xl font-bold text-emerald-700">{loading ? '…' : stats?.totalQuestions ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-text-tertiary mt-0.5">Asked</p></div>
            <div className="rounded-lg bg-blue-50 p-2.5 dark:bg-blue-950/20"><p className="text-xl font-bold text-blue-700">{loading ? '…' : stats?.totalApproved ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-text-tertiary mt-0.5">Approved</p></div>
            <div className="rounded-lg bg-violet-50 p-2.5 dark:bg-violet-950/20"><p className="text-xl font-bold text-violet-700">{loading ? '…' : stats?.totalAnswers ?? 0}</p><p className="text-[10px] uppercase tracking-wider text-text-tertiary mt-0.5">Answers</p></div>
          </div>
        </CardContent>
      </Card>

      {/* ── Earn Rewards (mirrors mobile home screen) ─────────────────────── */}
      <section aria-labelledby="earn-rewards-heading">
        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <h3 id="earn-rewards-heading" className="text-base font-bold text-foreground">Earn Rewards</h3>
            <InfoTip label="About rewards" description="Earn more as your approved question count grows — up to Rs.10 per question once you reach the Gold tier." />
          </div>
          <p className="text-xs text-text-secondary">Rs.10 for 251–500 approved questions</p>
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="relative">
              {/* Background track spanning the three tier nodes */}
              <div className="pointer-events-none absolute left-[18px] right-[18px] top-[17px] h-0.5 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
              {/* Bronze → Silver connector (Bronze colour) */}
              <div className="pointer-events-none absolute left-[18px] top-[16px] h-1 w-[calc(50%-18px)] rounded-full bg-orange-600" aria-hidden="true" />
              {/* Silver → Gold connector (Silver colour) */}
              <div className="pointer-events-none absolute left-1/2 top-[16px] h-1 w-[calc(50%-18px)] rounded-full bg-slate-400" aria-hidden="true" />

              <div className="relative flex items-start justify-between gap-2">
                {TIER_DISPLAY.map((tier, i) => {
                  const range = REWARD_TIERS[i]
                  return (
                    <div key={tier.key} className="flex flex-1 flex-col items-center">
                      <div
                        className={cn(
                          'z-10 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm',
                          tier.bg,
                        )}
                        aria-hidden="true"
                      >
                        <Leaf className="h-4 w-4" />
                      </div>
                      <div className="mt-3 text-center">
                        <p className={cn('text-xs font-extrabold', tier.text)}>{tier.label}</p>
                        <p className="mt-0.5 text-[10px] text-text-secondary">
                          {range.min}–{range.max}Qs
                        </p>
                        <p className="mt-1 text-base font-extrabold text-foreground">Rs.{range.reward}/Q</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* "Reach Gold Tier" callout — routes to the ask page */}
        <button
          type="button"
          onClick={() => navigate('/public/ask')}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left transition-colors hover:bg-emerald-100/70 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
        >
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-foreground">Reach Gold Tier</p>
              <p className="text-xs text-text-secondary">Earn up to Rs.10 per question after 250 approvals</p>
            </div>
          </div>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40" aria-hidden="true">
            <ArrowRight className="h-3.5 w-3.5 text-emerald-700" />
          </span>
        </button>
      </section>

      {/* ── Submission Tips (mirrors mobile home screen) ───────────────────── */}
      <section aria-labelledby="submission-tips-heading">
        <div className="mb-3 flex items-center gap-1.5">
          <h3 id="submission-tips-heading" className="text-base font-bold text-foreground">Submission Tips</h3>
          <InfoTip label="About submission tips" description="Follow these tips to keep your submissions high-quality and within platform limits." />
        </div>
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              <li className="flex items-center gap-3 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/30" aria-hidden="true">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                </span>
                <span className="text-sm text-foreground">Daily limit — {dailyLimit} questions per day</span>
              </li>
              <li className="flex items-center gap-3 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/30" aria-hidden="true">
                  <PenLine className="h-3.5 w-3.5 text-amber-600" />
                </span>
                <span className="text-sm text-foreground">
                  {editWindowSec === 0
                    ? 'Questions cannot be edited after submission'
                    : `Edit window — ${editWindowSec} seconds after submission`}
                </span>
              </li>
              <li className="flex items-center gap-3 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/30" aria-hidden="true">
                  <Lightbulb className="h-3.5 w-3.5 text-violet-600" />
                </span>
                <span className="text-sm text-foreground">AI relevance check runs automatically before posting</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <p className="text-center text-xs text-text-tertiary">AnnaDatha · Made for Indian farmers</p>
    </div>
  )
}