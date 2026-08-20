import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { adminApi, questionApi, walletApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { CompleteProfileModal } from '@/components/profile/CompleteProfileModal'
import { VideoSection } from '@/components/VideoSection'
import {
  Wallet, Trophy, Calendar, PenLine, Lightbulb, ArrowRight, Info, Leaf,
  Sprout, MapPin, CheckCircle2, Clock, PenSquare, Medal,
  ChevronRight,
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
          className="inline-flex items-center justify-center text-text-tertiary transition-colors hover:text-primary"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{description}</TooltipContent>
    </Tooltip>
  )
}

interface StatCardProps {
  icon: ReactNode
  iconBg: string
  label: string
  value: string
  sub?: string
  milestone?: string
}

function StatCard({ icon, iconBg, label, value }: StatCardProps) {
  return (
    <Card className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10', iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-foreground sm:text-sm lg:text-base">{value}</p>
        <p className="truncate text-[10px] text-text-secondary sm:text-[11px]">{label}</p>
      </div>
    </Card>
  )
}

interface ActionCardProps {
  icon: ReactNode
  iconBg: string
  title: string
  description: string
  cta: string
  onClick: () => void
}

function ActionCard({ icon, iconBg, title, description, cta, onClick }: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-2xl border border-border-subtle bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:p-5 lg:p-6"
    >
      {/* Background gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative">
        <div className={cn('mb-3 flex h-12 w-12 items-center justify-center rounded-xl sm:mb-4 sm:h-14 sm:w-14', iconBg)}>
          {icon}
        </div>
        <h3 className="text-sm font-bold text-foreground sm:text-base lg:text-lg">{title}</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-text-secondary sm:text-xs lg:text-sm">
          {description}
        </p>
        <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-primary sm:text-xs">
          {cta}
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  )
}

interface TipCardProps {
  icon: ReactNode
  iconBg: string
  title: string
  description: string
}

function TipCard({ icon, iconBg, title, description }: TipCardProps) {
  return (
    <div className="flex gap-3 rounded-xl border border-border-subtle bg-card p-3 sm:p-4">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10', iconBg)}>
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-bold text-foreground sm:text-xs">{title}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-text-secondary sm:text-[11px]">
          {description}
        </p>
      </div>
    </div>
  )
}

const TIER_DISPLAY = [
  { key: 'bronze', bg: 'bg-orange-500', text: 'text-orange-600', light: 'from-orange-50 to-amber-50' },
  { key: 'silver', bg: 'bg-slate-400',  text: 'text-slate-500',  light: 'from-slate-50 to-gray-50' },
  { key: 'gold',   bg: 'bg-amber-500',  text: 'text-amber-600',  light: 'from-amber-50 to-yellow-50' },
] as const

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

  const locationState = location.state as { mobileNumber?: string } | null
  const postOtpMobile = locationState?.mobileNumber
    ? locationState.mobileNumber.replace(/\D/g, '').slice(-10)
    : null
  const showProfileModal = !!postOtpMobile && !user

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

  const tierIdx = currentTierIndex(stats?.totalApproved ?? 0)
  const currentTier = TIER_DISPLAY[tierIdx]

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-20 sm:pb-6 lg:space-y-6 lg:pb-6">

      {/* ── Hero header card ── */}
      <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 shadow-lg">
        {/* Decorative background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Decorative glow orb */}
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5 lg:p-6">
          {/* Avatar */}
          <div className="relative shrink-0 self-center sm:self-auto">
            {/* Animated glow ring for verified */}
            {isVerified && (
              <div className="absolute inset-0 rounded-full animate-pulse bg-emerald-400/30 blur-sm" />
            )}
            <div className={cn(
              'relative flex h-16 w-16 items-center justify-center rounded-full text-xl font-extrabold sm:h-18 sm:w-18 lg:h-20 lg:w-20',
              'bg-white/15 text-white ring-[3px] ring-white/25 backdrop-blur-sm',
              isVerified && 'ring-emerald-400/50',
            )}>
              {initials}
            </div>
            {isVerified && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-900 bg-emerald-400 text-emerald-950 shadow-lg">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-sm font-medium text-emerald-300">{greeting},</p>
            <h1 className="mt-0.5 truncate text-2xl font-black text-white sm:text-3xl lg:text-4xl">
              {name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {categoryText && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm sm:text-xs">
                  <Sprout className="h-3.5 w-3.5" />
                  {categoryText}
                </span>
              )}
              {isVerified && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur-sm sm:text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t('home.verifiedUser')}
                </span>
              )}
            </div>
            {user?.state && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-emerald-300/70 sm:justify-start sm:text-xs">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">
                  {user.state}
                  {user.district ? ` > ${user.district}` : ''}
                </span>
              </div>
            )}

            {/* Tier progress chip */}
            {tierIdx < 2 && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 sm:mt-3">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-700"
                    style={{ width: `${Math.min(100, ((stats?.totalApproved ?? 0) / (REWARD_TIERS[tierIdx + 1]?.min || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-amber-300 sm:text-xs">
                  {REWARD_TIERS[tierIdx + 1]?.min - (stats?.totalApproved ?? 0)} to {t(`home.${TIER_DISPLAY[tierIdx + 1].key}`)}
                </span>
              </div>
            )}
            {tierIdx === 2 && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[10px] font-bold text-amber-300 sm:text-xs">
                <Trophy className="h-3.5 w-3.5" />
                {t('home.gold')} tier — highest rewards unlocked!
              </div>
            )}
          </div>

          {/* Current tier badge */}
          <div className="hidden sm:flex shrink-0 flex-col items-center gap-1.5">
            <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg', currentTier.bg)}>
              <Leaf className="h-7 w-7 text-white" />
            </div>
            <p className={cn('text-[10px] font-black uppercase tracking-widest sm:text-xs', currentTier.text)}>
              {t(`home.${currentTier.key}`)}
            </p>
            <p className="text-[10px] text-emerald-400/60">Current tier</p>
          </div>
        </div>

      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Wallet className="h-4 w-4 text-white" />}
          iconBg="bg-emerald-500"
          label={t('home.walletBalance')}
          value={loading ? '...' : `\u20B9${balance.toFixed(0)}`}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-white" />}
          iconBg="bg-blue-500"
          label={t('home.today')}
          value={loading ? '...' : stats ? `${stats.dailyCount}` : '0'}
        />
        <StatCard
          icon={<Clock className="h-4 w-4 text-white" />}
          iconBg="bg-amber-500"
          label={t('home.remaining')}
          value={loading ? '...' : stats ? `${stats.remainingToday}` : '0'}
        />
        <StatCard
          icon={<Medal className="h-4 w-4 text-white" />}
          iconBg={currentTier.key === 'gold'
            ? 'bg-amber-500'
            : currentTier.key === 'silver'
              ? 'bg-slate-400'
              : 'bg-orange-500'}
          label={t('home.currentTier')}
          value={loading ? '...' : t(`home.${currentTier.key}`)}
        />
      </div>

      {/* ── Video Section ── */}
      <VideoSection />

      {/* ── Quick Actions ── */}
      <section aria-labelledby="quick-actions-heading">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="quick-actions-heading" className="text-base font-bold text-foreground sm:text-lg">
            {t('home.quickActions')}
          </h2>
          <InfoTip label={t('home.aboutQuickActions')} description={t('home.quickActionsTip')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <ActionCard
            icon={<PenSquare className="h-6 w-6 text-white" />}
            iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700"
            title={t('home.askQuestion')}
            description={t('home.askQuestionSub')}
            cta="Start asking"
            onClick={() => navigate('/home/ask')}
          />
          <ActionCard
            icon={<Wallet className="h-6 w-6 text-white" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
            title={t('home.myWallet')}
            description={t('home.myWalletSub')}
            cta="View wallet"
            onClick={() => navigate('/home/wallet')}
          />
        </div>
      </section>

      {/* ── Earn Rewards ── */}
      <section aria-labelledby="earn-rewards-heading">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="earn-rewards-heading" className="text-base font-bold text-foreground sm:text-lg">
            {t('home.earnRewards')}
          </h2>
          <InfoTip label={t('home.aboutRewards')} description={t('home.rewardsTip')} />
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-4 sm:p-5 lg:p-6">
            {/* Tier steps */}
            <div className="flex items-start justify-between gap-2">
              {TIER_DISPLAY.map((tier, i) => {
                const range = REWARD_TIERS[i]
                const isActive = i <= tierIdx
                const isCurrent = i === tierIdx
                return (
                  <div key={tier.key} className="flex flex-1 flex-col items-center text-center">
                    {/* Connector line */}
                    {i > 0 && (
                      <div className="absolute inset-x-0 top-5 -z-10 h-0.5 bg-border-subtle" style={{ display: 'none' }} />
                    )}
                    <div
                      className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-full text-white sm:h-12 sm:w-12 lg:h-14 lg:w-14',
                        tier.bg,
                        isActive ? 'opacity-100 shadow-md' : 'opacity-40',
                        isCurrent && 'ring-4 ring-offset-2 ring-offset-card',
                      )}
                      style={isCurrent ? { boxShadow: `0 0 0 4px var(--tw-ring-color, hsl(var(--primary)/0.2))` } : {}}
                    >
                      <Leaf className="h-5 w-5 lg:h-6 lg:w-6" />
                    </div>
                    <div className="mt-2 sm:mt-3">
                      <p className={cn(
                        'text-[11px] font-extrabold sm:text-xs lg:text-sm',
                        isActive ? tier.text : 'text-text-tertiary',
                      )}>
                        {t(`home.${tier.key}`)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-text-tertiary sm:text-[11px]">
                        {range.min}–{range.max}{t('home.questions')}
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-foreground sm:text-base lg:text-lg">
                        Rs.{range.reward}{t('home.perQuestion')}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="mt-2 inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary sm:text-xs">
                        You are here
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Progress indicator */}
            <div className="mt-4 sm:mt-5">
              <div className="flex items-center justify-between text-[10px] text-text-tertiary sm:text-xs">
                <span>{stats?.totalApproved ?? 0} approved</span>
                <span>{t('home.reachGold')}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-variant">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-700 transition-all duration-700"
                  style={{
                    width: `${Math.min(100, ((stats?.totalApproved ?? 0) / (REWARD_TIERS[2].min || 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={() => navigate('/home/ask')}
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-border-subtle bg-gradient-to-r from-emerald-50 to-green-50 p-3 text-left transition-all hover:border-emerald-300 hover:shadow-md dark:from-emerald-950/30 dark:to-green-950/30 dark:hover:border-emerald-800 sm:mt-5 sm:p-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                  <Trophy className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground sm:text-sm">{t('home.reachGold')}</p>
                  <p className="mt-0.5 text-[11px] text-text-secondary sm:text-xs">
                    {t('home.reachGoldSub')}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            </button>
          </CardContent>
        </Card>
      </section>

      {/* ── Submission Tips ── */}
      <section aria-labelledby="submission-tips-heading">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="submission-tips-heading" className="text-base font-bold text-foreground sm:text-lg">
            {t('home.submissionTips')}
          </h2>
          <InfoTip label={t('home.aboutSubmissionTips')} description={t('home.guidelinesTip')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <TipCard
            icon={<Calendar className="h-4 w-4 text-white" />}
            iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
            title={`Daily limit: ${dailyLimit} Qs`}
            description={t('home.dailyLimitTip', { count: dailyLimit })}
          />
          <TipCard
            icon={<PenLine className="h-4 w-4 text-white" />}
            iconBg="bg-gradient-to-br from-amber-500 to-orange-600"
            title="Edit window"
            description={
              editWindowSec === 0
                ? t('home.editWindowClosed')
                : t('home.editWindowTip').replace('{seconds}', String(editWindowSec))
            }
          />
          <TipCard
            icon={<Lightbulb className="h-4 w-4 text-white" />}
            iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
            title="AI relevance check"
            description={t('home.aiCheckTip')}
          />
        </div>
      </section>

      {/* ── Footer ── */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <div className="h-px flex-1 bg-border-subtle" />
        <p className="px-3 text-center text-[11px] text-text-tertiary sm:text-xs">
          {t('app.footer')}
        </p>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>

      {showProfileModal && (
        <CompleteProfileModal
          open={showProfileModal}
          mobileNumber={postOtpMobile ?? ''}
        />
      )}
    </div>
  )
}