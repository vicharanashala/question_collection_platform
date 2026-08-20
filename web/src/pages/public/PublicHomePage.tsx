import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { adminApi, questionApi, walletApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { CompleteProfileModal } from '@/components/profile/CompleteProfileModal'
import {
  Wallet, Trophy, Calendar, PenLine, Lightbulb, ArrowRight, Info, Leaf,
  Sprout, MapPin, CheckCircle2, Clock, PenSquare, Medal,
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
        <p className="text-sm sm:text-base font-bold leading-tight text-foreground lg:text-2xl">{value}</p>
        <p className="text-[11px] leading-tight text-text-secondary lg:text-xs sm:text-sm">{label}</p>
      </CardContent>
    </Card>
  )
}

interface QuickActionProps {
  icon: ReactNode
  iconClass: string
  label: string
  sub: string
  onClick: () => void
}

function QuickAction({ icon, iconClass, label, sub, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted lg:p-5"
    >
      <span className={iconClass}>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm font-bold text-foreground lg:text-sm sm:text-base">{label}</p>
        <p className="text-[11px] sm:text-xs text-text-secondary lg:text-xs sm:text-sm">{sub}</p>
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

// Index into TIER_DISPLAY / REWARD_TIERS for a given approved-question count.
function currentTierIndex(approved: number): number {
  for (let i = REWARD_TIERS.length - 1; i >= 0; i--) {
    if (approved >= REWARD_TIERS[i].min) return i
  }
  return 0
}

export function PublicHomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [stats, setStats] = useState<Stats | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [dailyLimit, setDailyLimit] = useState<number>(20)
  const [editWindowSec, setEditWindowSec] = useState<number>(0)



  // ─── Complete-profile wizard modal ───────────────────────────────────────
  // Opens automatically only when the visitor has just verified an OTP for
  // the first time -- i.e. this is a *new* public user going through the
  // registration flow. We detect this via the router state `mobileNumber`
  // that `LoginPage` / `PublicRegisterPage` attach when navigating to
  // `/home` after a successful `requiresRegistration: true` response.
  //
  // We deliberately do NOT show the modal for already-registered users,
  // even if their profile data is somehow incomplete on the backend.
  // Those users can edit their profile from the dedicated `/home/profile`
  // page.
  //
  // The modal itself swallows backdrop / ESC / X-close attempts so the
  // user is forced to either complete the wizard or stay on this page.
  const locationState = location.state as { mobileNumber?: string } | null
  const postOtpMobile = locationState?.mobileNumber?.replace(/\D/g, '').slice(-10) || null
  const showProfileModal = !!postOtpMobile

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
    // what staff have set. The endpoint is admin-scoped — only attempt it
    // for admin/finance roles so the 403 never occurs for regular users.
    if (user && ['admin', 'super_admin', 'finance'].includes(user.role)) {
      adminApi.getConfig()
        .then((res) => {
          if (!alive) return
          const found = (res.items ?? []).find((c: any) => c.key === 'question_edit_window_seconds')
          setEditWindowSec(found?.value ?? 0)
        })
        .catch((e) => console.warn(getErrorMessage(e, 'admin config')))
    }

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

  // Current reward tier, derived from the already-fetched approved-question
  // count (same ranges/logic the Profile page uses for its tier card).
  const tierIdx = currentTierIndex(stats?.totalApproved ?? 0)
  const currentTier = TIER_DISPLAY[tierIdx]

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-6 lg:space-y-6">
      {/* Header row -- flat greeting, no banner/gradient. Mirrors the mobile
          home screen's data (name, category, verification, location) with a
          plain desktop-dashboard header treatment instead of a hero card. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-xs sm:text-sm text-text-secondary">{greeting},</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-2xl font-bold text-foreground lg:text-3xl">{name}</h1>
            {categoryText && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] sm:text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <Sprout className="h-3.5 w-3.5" />
                {categoryText}
              </span>
            )}
          </div>
          {user?.state && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">
              <MapPin className="h-3.5 w-3.5" />
              <span className="truncate">
                {user.state}
                {user.district ? ` > ${user.district}` : ''}
              </span>
            </div>
          )}
        </div>

        <div className="relative shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-sm sm:text-base font-bold text-emerald-700 dark:text-emerald-400 lg:h-12 lg:w-12 lg:text-base sm:text-lg">
            {initials}
          </div>
          {isVerified && (
            <span
              className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-emerald-500 text-white"
              aria-label={t('home.verifiedUser')}
            >
              <CheckCircle2 className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>

      {/* Stats -- four tiles: Wallet / Today / Remaining / current reward tier */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatTile
          icon={<Wallet className="h-4 w-4 lg:h-5 lg:w-5" />}
          label={t('home.walletBalance')}
          value={loading ? '...' : `\u20B9${balance.toFixed(0)}`}
          iconClass="text-emerald-600 dark:text-emerald-400"
        />
        <StatTile
          icon={<CheckCircle2 className="h-4 w-4 lg:h-5 lg:w-5" />}
          label={t('home.today')}
          value={loading ? '...' : stats ? t('home.dailyCountDone', { count: stats.dailyCount }) : '0'}
          iconClass="text-blue-600 dark:text-blue-400"
        />
        <StatTile
          icon={<Clock className="h-4 w-4 lg:h-5 lg:w-5" />}
          label={t('home.remaining')}
          value={loading ? '...' : stats ? `${stats.remainingToday}` : '0'}
          iconClass="text-amber-600 dark:text-amber-400"
        />
        <StatTile
          icon={<Medal className="h-4 w-4 lg:h-5 lg:w-5" />}
          label={t('home.currentTier')}
          value={loading ? '...' : t(`home.${currentTier.key}`)}
          iconClass={currentTier.text}
        />
      </div>

      {/* Quick Actions + Earn Rewards -- stacked on mobile, side-by-side on
          desktop. The two columns stretch to equal height by default; Quick
          Actions is a flex column so its action cards grow to fill that
          height instead of leaving dead space below them. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
        {/* Quick Actions -- mirrors mobile home screen */}
        <section aria-labelledby="quick-actions-heading" className="flex flex-col lg:h-full">
          <div className="mb-3 flex items-center gap-1.5">
            <h3 id="quick-actions-heading" className="text-sm sm:text-sm sm:text-base font-bold text-foreground">{t('home.quickActions')}</h3>
            <InfoTip label={t('home.aboutQuickActions')} description={t('home.quickActionsTip')} />
          </div>
          <Card className="lg:flex lg:flex-1 lg:flex-col lg:justify-center">
            <CardContent className="grid grid-cols-1 divide-y divide-border-subtle p-0 sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
              <QuickAction
                icon={<PenSquare className="h-5 w-5 lg:h-6 lg:w-6" />}
                iconClass="text-emerald-600 dark:text-emerald-400"
                label={t('home.askQuestion')}
                sub={t('home.askQuestionSub')}
onClick={() => navigate('/home/ask')}
              />
              <QuickAction
                icon={<Wallet className="h-5 w-5 lg:h-6 lg:w-6" />}
                iconClass="text-emerald-600 dark:text-emerald-400"
                label={t('home.myWallet')}
                sub={t('home.myWalletSub')}
                onClick={() => navigate('/home/wallet')}
              />
            </CardContent>
          </Card>
        </section>

        {/* Earn Rewards -- mirrors the mobile home screen */}
        <section aria-labelledby="earn-rewards-heading">
          <div className="mb-3">
            <div className="flex items-center gap-1.5">
              <h3 id="earn-rewards-heading" className="text-sm sm:text-sm sm:text-base font-bold text-foreground">{t('home.earnRewards')}</h3>
              <InfoTip label={t('home.aboutRewards')} description={t('home.rewardsTip')} />
            </div>
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">{t('home.rewardSubtitle')}</p>
          </div>

          <Card>
            <CardContent className="p-5 lg:p-6">
              <div className="flex items-start justify-between gap-2">
                {TIER_DISPLAY.map((tier, i) => {
                  const range = REWARD_TIERS[i]
                  return (
                    <div key={tier.key} className="flex flex-1 flex-col items-center">
                      <div
                        className={cn('flex h-9 w-9 items-center justify-center rounded-full text-white lg:h-11 lg:w-11', tier.bg)}
                        aria-hidden="true"
                      >
                        <Leaf className="h-4 w-4 lg:h-5 lg:w-5" />
                      </div>
                      <div className="mt-3 text-center">
                        <p className={cn('text-[11px] sm:text-xs font-extrabold lg:text-xs sm:text-sm', tier.text)}>{t(`home.${tier.key}`)}</p>
                        <p className="mt-0.5 text-[10px] text-text-secondary lg:text-[11px] sm:text-xs">
                          {range.min}-{range.max}{t('home.questions')}
                        </p>
                        <p className="mt-1 text-sm sm:text-base font-extrabold text-foreground lg:text-base sm:text-lg">Rs.{range.reward}{t('home.perQuestion')}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => navigate('/home/ask')}
                className="mt-5 flex w-full items-center justify-between rounded-lg border border-border-subtle p-3 text-left transition-colors hover:border-emerald-300 dark:hover:border-emerald-800"
              >
                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <div>
                    <p className="text-xs sm:text-xs sm:text-sm font-bold text-foreground">{t('home.reachGold')}</p>
                    <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">{t('home.reachGoldSub')}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
              </button>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Submission Tips (mirrors mobile home screen) -- a stacked list on
          mobile, a 3-up row of tip cards on desktop */}
      <section aria-labelledby="submission-tips-heading">
        <div className="mb-3 flex items-center gap-1.5">
          <h3 id="submission-tips-heading" className="text-sm sm:text-sm sm:text-base font-bold text-foreground">{t('home.submissionTips')}</h3>
          <InfoTip label={t('home.aboutSubmissionTips')} description={t('home.guidelinesTip')} />
        </div>
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border-subtle sm:grid sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
              <li className="flex items-center gap-3 p-4">
                <Calendar className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span className="text-xs sm:text-xs sm:text-sm text-foreground">{t('home.dailyLimitTip', { count: dailyLimit })}</span>
              </li>
              <li className="flex items-center gap-3 p-4">
                <PenLine className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span className="text-xs sm:text-xs sm:text-sm text-foreground">
                  {editWindowSec === 0
                    ? t('home.editWindowClosed')
                    : t('home.editWindowTip').replace('{seconds}', String(editWindowSec))}
                </span>
              </li>
              <li className="flex items-center gap-3 p-4">
                <Lightbulb className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />
                <span className="text-xs sm:text-xs sm:text-sm text-foreground">{t('home.aiCheckTip')}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <p className="pt-2 text-center text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">{t('app.footer')}</p>

      {/*
        Complete-profile wizard modal. Renders only when the page detects an
        incomplete profile. The modal is non-dismissible; the wizard inside
        navigates to /home/verification-pending on success, which unmounts
        the dashboard + modal together.
      */}
      {showProfileModal && (
        <CompleteProfileModal
          open={showProfileModal}
          mobileNumber={postOtpMobile ?? user?.mobileNumber ?? ''}
        />
      )}
    </div>
  )
}
