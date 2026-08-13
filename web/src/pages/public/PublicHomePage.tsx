import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { adminApi, questionApi, walletApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Wallet, Trophy, Calendar, PenLine, Lightbulb, ArrowRight, Info, Leaf,
  Sprout, MapPin, CheckCircle2, Clock, PenSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { REWARD_TIERS, categoryLabel } from '@/constants/public'

interface Stats {
  dailyCount: number
  remainingToday: number
  totalApproved: number
  dailyLimit?: number
  [k: string]: unknown
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

interface StatTileProps {
  icon: ReactNode
  label: string
  value: string
  iconClass: string
}

function StatTile({ icon, label, value, iconClass }: StatTileProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-3 lg:gap-2.5 lg:p-5">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg lg:h-12 lg:w-12', iconClass)}>
          {icon}
        </span>
        <p className="text-base font-bold leading-tight text-foreground lg:text-2xl">{value}</p>
        <p className="text-[11px] leading-tight text-text-secondary lg:text-sm">{label}</p>
      </CardContent>
    </Card>
  )
}

interface QuickActionProps {
  icon: ReactNode
  iconWrapClass: string
  iconClass: string
  label: string
  sub: string
  onClick: () => void
}

function QuickAction({ icon, iconWrapClass, iconClass, label, sub, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="group flex h-full flex-col items-start gap-2.5 rounded-xl border border-emerald-100 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-emerald-900/40 dark:bg-surface dark:hover:border-emerald-800 lg:justify-center lg:gap-3 lg:p-6"
    >
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg lg:h-12 lg:w-12', iconWrapClass)}>
        <span className={iconClass}>{icon}</span>
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground lg:text-base">{label}</p>
        <p className="text-xs text-text-secondary lg:text-sm">{sub}</p>
      </div>
    </button>
  )
}

// Tier display config — mirrors the mobile home screen's Bronze → Silver → Gold
// step path. Source-of-truth ranges live in REWARD_TIERS; this is presentation only.
const TIER_DISPLAY = [
  { key: 'bronze', bg: 'bg-orange-600', text: 'text-orange-600', track: 'bg-orange-600' },
  { key: 'silver', bg: 'bg-slate-400',  text: 'text-slate-500',  track: 'bg-slate-400' },
  { key: 'gold',   bg: 'bg-amber-500',  text: 'text-amber-500',  track: 'bg-amber-500' },
] as const

export function PublicHomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [stats, setStats] = useState<Stats | null>(null)
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
          const v = s.value as Stats
          setStats(v)
          setDailyLimit(v.dailyLimit ?? 20)
        }
        if (w.status === 'fulfilled') setBalance(w.value.balance ?? 0)
      })
      .catch((e) => console.warn(getErrorMessage(e, 'home load')))
      .finally(() => { if (alive) setLoading(false) })

    // Try to read the configured edit-window length so the tip row matches
    // what staff have set. The endpoint is admin-scoped, so a public user
    // gets a 403 and we fall back to "closed" (matches mobile).
    adminApi.getConfig()
      .then((res) => {
        if (!alive) return
        const found = (res.items ?? []).find((c) => c.key === 'question_edit_window_seconds')
        setEditWindowSec(found?.value ?? 0)
      })
      .catch(() => { /* public users can't read admin config -- default 0 */ })

    return () => { alive = false }
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12
      ? t('home.greeting.morning')
      : h < 17
        ? t('home.greeting.afternoon')
        : t('home.greeting.evening')
  })()
  const name = user?.name?.split(' ')[0] || t('home.farmer')
  const isVerified = user?.verificationStatus === 'verified'
  const initials = (user?.name?.charAt(0) || '?').toUpperCase()

  // Translate the category pill — falls back to the English `categoryLabel`
  // utility for unknown values. Mirrors the mobile HomeScreen behaviour where
  // `home.farmer`/`home.fpo`/... are the i18n keys for the user category.
  const CATEGORY_KEYS: Record<string, string> = {
    farmer: 'home.farmer',
    fpo: 'home.fpo',
    student: 'home.student',
    volunteer: 'home.volunteer',
    ngo: 'home.ngo',
  }
  const categoryText = user?.category
    ? (CATEGORY_KEYS[user.category] ? t(CATEGORY_KEYS[user.category]) : categoryLabel(user.category))
    : null

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-6 lg:space-y-6">
      {/* Top row -- on desktop all four cards (hero + 3 stats) sit in a single
          row, with the green hero card on the right. The stats wrapper below
          uses `lg:contents` so its children become direct items of this grid
          (dissolving the wrapper) instead of a nested sub-grid. */}
      <div className="grid gap-4 lg:grid-cols-4 lg:gap-4">
        {/* Hero greeting card -- mirrors the mobile home screen. order-last
            (desktop only) puts it after the stats, i.e. on the right. */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 p-5 text-white shadow-md lg:order-last">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" aria-hidden="true" />
          <div className="absolute -right-2 bottom-0 h-20 w-20 rounded-full bg-white/5" aria-hidden="true" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-white/80">{greeting},</p>
              <h1 className="mt-0.5 truncate text-2xl font-bold">{name}</h1>
              {categoryText && (
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">
                  <Sprout className="h-3.5 w-3.5" />
                  {categoryText}
                </span>
              )}
            </div>

            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/25 text-xl font-bold backdrop-blur-sm">
                {initials}
              </div>
              {isVerified && (
                <span
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-600 bg-emerald-400 text-white"
                  aria-label={t('home.verifiedUser')}
                >
                  <CheckCircle2 className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>

          {user?.state && (
            <div className="relative mt-3 flex items-center gap-1.5 text-xs text-white/85">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">
                {user.state}
                {user.district ? ` > ${user.district}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Stats -- three tiles mirroring mobile (Wallet / Today / Remaining); a
            row on mobile/tablet. `lg:contents` dissolves this wrapper on
            desktop so the tiles become direct siblings of the hero card,
            all four landing in one row. */}
        <div className="grid grid-cols-3 gap-3 lg:contents">
          <StatTile
            icon={<Wallet className="h-4 w-4 lg:h-5 lg:w-5" />}
            label={t('home.walletBalance')}
            value={loading ? '...' : `\u20B9${balance.toFixed(0)}`}
            iconClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
          />
          <StatTile
            icon={<CheckCircle2 className="h-4 w-4 lg:h-5 lg:w-5" />}
            label={t('home.today')}
            value={loading ? '...' : stats ? `${stats.dailyCount} done` : '0'}
            iconClass="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
          />
          <StatTile
            icon={<Clock className="h-4 w-4 lg:h-5 lg:w-5" />}
            label={t('home.remaining')}
            value={loading ? '...' : stats ? `${stats.remainingToday}` : '0'}
            iconClass="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
          />
        </div>
      </div>

      {/* Quick Actions + Earn Rewards -- stacked on mobile, side-by-side on
          desktop. The two columns stretch to equal height by default; Quick
          Actions is a flex column so its action cards grow to fill that
          height instead of leaving dead space below them. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        {/* Quick Actions -- mirrors mobile home screen */}
        <section aria-labelledby="quick-actions-heading" className="flex flex-col lg:h-full">
          <div className="mb-3 flex items-center gap-1.5">
            <h3 id="quick-actions-heading" className="text-base font-bold text-foreground">{t('home.quickActions')}</h3>
            <InfoTip label={t('home.aboutQuickActions')} description={t('home.quickActionsTip')} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:flex-1">
            <QuickAction
              icon={<PenSquare className="h-5 w-5 lg:h-6 lg:w-6" />}
              iconWrapClass="bg-emerald-500/10"
              iconClass="text-emerald-700 dark:text-emerald-400"
              label={t('home.askQuestion')}
              sub={t('home.askQuestionSub')}
              onClick={() => navigate('/public/ask')}
            />
            <QuickAction
              icon={<Wallet className="h-5 w-5 lg:h-6 lg:w-6" />}
              iconWrapClass="bg-emerald-500/10"
              iconClass="text-emerald-700 dark:text-emerald-400"
              label={t('home.myWallet')}
              sub={t('home.myWalletSub')}
              onClick={() => navigate('/public/wallet')}
            />
          </div>
        </section>

        {/* Earn Rewards -- mirrors the mobile home screen */}
        <section aria-labelledby="earn-rewards-heading">
          <div className="mb-3">
            <div className="flex items-center gap-1.5">
              <h3 id="earn-rewards-heading" className="text-base font-bold text-foreground">{t('home.earnRewards')}</h3>
              <InfoTip label={t('home.aboutRewards')} description={t('home.rewardsTip')} />
            </div>
            <p className="text-xs text-text-secondary">{t('home.rewardSubtitle')}</p>
          </div>

          <Card>
            <CardContent className="p-5 lg:p-6">
              <div className="relative">
                <div className="pointer-events-none absolute left-[18px] right-[18px] top-[17px] h-0.5 bg-slate-200 dark:bg-slate-700 lg:left-[22px] lg:right-[22px] lg:top-[21px]" aria-hidden="true" />
                <div className="pointer-events-none absolute left-[18px] top-[16px] h-1 w-[calc(50%-18px)] rounded-full bg-orange-600 lg:left-[22px] lg:top-[20px] lg:w-[calc(50%-22px)]" aria-hidden="true" />
                <div className="pointer-events-none absolute left-1/2 top-[16px] h-1 w-[calc(50%-18px)] rounded-full bg-slate-400 lg:top-[20px] lg:w-[calc(50%-22px)]" aria-hidden="true" />

                <div className="relative flex items-start justify-between gap-2">
                  {TIER_DISPLAY.map((tier, i) => {
                    const range = REWARD_TIERS[i]
                    return (
                      <div key={tier.key} className="flex flex-1 flex-col items-center">
                        <div
                          className={cn('z-10 flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm lg:h-11 lg:w-11', tier.bg)}
                          aria-hidden="true"
                        >
                          <Leaf className="h-4 w-4 lg:h-5 lg:w-5" />
                        </div>
                        <div className="mt-3 text-center">
                          <p className={cn('text-xs font-extrabold lg:text-sm', tier.text)}>{t(`home.${tier.key}`)}</p>
                          <p className="mt-0.5 text-[10px] text-text-secondary lg:text-xs">
                            {range.min}-{range.max}{t('home.questions')}
                          </p>
                          <p className="mt-1 text-base font-extrabold text-foreground lg:text-lg">Rs.{range.reward}{t('home.perQuestion')}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <button
            type="button"
            onClick={() => navigate('/public/ask')}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left transition-colors hover:bg-emerald-100/70 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
          >
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-foreground">{t('home.reachGold')}</p>
                <p className="text-xs text-text-secondary">{t('home.reachGoldSub')}</p>
              </div>
            </div>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40" aria-hidden="true">
              <ArrowRight className="h-3.5 w-3.5 text-emerald-700" />
            </span>
          </button>
        </section>
      </div>

      {/* Submission Tips (mirrors mobile home screen) -- a stacked list on
          mobile, a 3-up row of tip cards on desktop */}
      <section aria-labelledby="submission-tips-heading">
        <div className="mb-3 flex items-center gap-1.5">
          <h3 id="submission-tips-heading" className="text-base font-bold text-foreground">{t('home.submissionTips')}</h3>
          <InfoTip label={t('home.aboutSubmissionTips')} description={t('home.guidelinesTip')} />
        </div>
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 sm:grid sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
              <li className="flex items-center gap-3 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/30" aria-hidden="true">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                </span>
                <span className="text-sm text-foreground">{t('home.dailyLimitTip', { count: dailyLimit })}</span>
              </li>
              <li className="flex items-center gap-3 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/30" aria-hidden="true">
                  <PenLine className="h-3.5 w-3.5 text-amber-600" />
                </span>
                <span className="text-sm text-foreground">
                  {editWindowSec === 0
                    ? t('home.editWindowClosed')
                    : t('home.editWindowTip').replace('{seconds}', String(editWindowSec))}
                </span>
              </li>
              <li className="flex items-center gap-3 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/30" aria-hidden="true">
                  <Lightbulb className="h-3.5 w-3.5 text-violet-600" />
                </span>
                <span className="text-sm text-foreground">{t('home.aiCheckTip')}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <p className="pt-2 text-center text-xs text-text-tertiary">{t('app.footer')}</p>
    </div>
  )
}
