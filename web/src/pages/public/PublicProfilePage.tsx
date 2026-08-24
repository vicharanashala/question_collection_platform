/**
 * Public Profile Page — redesigned to match the home page aesthetic:
 *   1. Hero card ─────────── emerald gradient, avatar, name, badges, tier progress chip
 *   2. Tier card ─────────── medal icon, approved count, progress bar, tier steps
 *   3. Stats row ─────────── 3 minimal tiles (Wallet / Questions / Member Since)
 *   4. Account section ───── Personal Info / Location / Education / Organization cards
 *   5. Actions section ───── Payment Methods / Report / Help & Feedback / Terms / Privacy / Contact Admin
 *   6. Sign Out ─────────── red outlined button with confirm dialog
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { questionApi, walletApi } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Phone, Leaf, Wallet, Calendar, Trophy, Medal,
  CheckCircle2, Clock, Eye, AlertCircle, XCircle,
  AtSign, Tag, Users, MapPin, Building2, MapPinned, Home, School,
  ChevronRight, LogOut, Flag, ShieldCheck, X,
  FileText, MessageSquarePlus, BookOpen, GraduationCap, Briefcase,
  CalendarDays, Sprout, Ruler, Loader2, HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { REWARD_TIERS, categoryLabel } from '@/constants/public'
import { cn, getInitials, formatDate } from '@/lib/utils'
import type { VerificationStatus } from '@/types'

// — Tier display config (positional: index 0=bronze, 1=silver, 2=gold) —
const TIER_DISPLAY = [
  { key: 'bronze', color: '#CD7F32', textClass: 'text-orange-600', bgClass: 'bg-orange-500' },
  { key: 'silver', color: '#A8A8A8', textClass: 'text-slate-500',  bgClass: 'bg-slate-400'  },
  { key: 'gold',   color: '#F59E0B', textClass: 'text-amber-600',  bgClass: 'bg-amber-500'  },
] as const

function currentTierIndex(approved: number): number {
  for (let i = REWARD_TIERS.length - 1; i >= 0; i--) {
    if (approved >= REWARD_TIERS[i].min) return i
  }
  return 0
}

// — Verification status pill config —
interface StatusConfig {
  label: string
  icon: typeof CheckCircle2
  classes: string
}
const VERIFICATION_CONFIG: Record<VerificationStatus, StatusConfig> = {
  verified: {
    label: 'status.verified',
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
  },
  pending: {
    label: 'status.pending',
    icon: Clock,
    classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
  },
  manual_review: {
    label: 'status.manual_review',
    icon: Eye,
    classes: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800',
  },
  suspended: {
    label: 'status.suspended',
    icon: AlertCircle,
    classes: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800',
  },
  banned: {
    label: 'status.banned',
    icon: XCircle,
    classes: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
  },
}

// — Sub-components ———————————————————————————————————

interface SectionHeaderProps {
  icon: typeof CheckCircle2
  title: string
  trailing?: ReactNode
}
function SectionHeader({ icon: Icon, title, trailing }: SectionHeaderProps) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <h3 className="flex-1 text-sm font-bold text-foreground">{title}</h3>
      {trailing}
    </div>
  )
}

interface AccountCardProps {
  icon: typeof MapPin
  title: string
  className?: string
  children: ReactNode
}
function AccountCard({ icon: Icon, title, className, children }: AccountCardProps) {
  return (
    <div className={cn('rounded-xl border border-border-subtle bg-card', className)}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
          {title}
        </h4>
      </div>
      <div className="border-t border-border-subtle">{children}</div>
    </div>
  )
}

interface AccountRowProps {
  icon: typeof MapPin
  label: string
  value: ReactNode
  isLast?: boolean
}
function AccountRow({ icon: Icon, label, value, isLast }: AccountRowProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-4 py-3.5', !isLast && 'border-b border-border-subtle')}>
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
        <span className="truncate text-xs text-text-tertiary">{label}</span>
      </div>
      <span className="truncate text-xs font-semibold text-foreground">
        {value || <span className="text-text-tertiary">—</span>}
      </span>
    </div>
  )
}

interface ActionRowProps {
  icon: typeof CheckCircle2
  label: string
  onClick: () => void
  danger?: boolean
}
function ActionRow({ icon: Icon, label, onClick, danger }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left last:border-b-0',
        danger
          ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20'
          : 'text-foreground hover:bg-surface-variant/50',
      )}
    >
      <span className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
        danger ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30' : 'bg-primary/10 text-primary',
      )}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      <ChevronRight className="h-4 w-4 text-text-tertiary" />
    </button>
  )
}

interface StatTileProps {
  icon: typeof Wallet
  value: string
  label: string
  loading?: boolean
}
function StatTile({ icon: Icon, value, label, loading }: StatTileProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border-subtle bg-card p-2.5 sm:flex-row sm:gap-2.5 sm:p-3 sm:items-start">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          : <Icon className="h-3.5 w-3.5 text-primary" />
        }
      </div>
      <div className="min-w-0 text-center sm:text-left">
        <p className="truncate text-xs font-extrabold text-foreground sm:text-sm">{loading ? '...' : value}</p>
        <p className="truncate text-[10px] text-text-secondary">{loading ? '—' : label}</p>
      </div>
    </div>
  )
}

// — Main page ——————————————————————————————————————————————————————

const em = '\u2014'
const rupee = '\u20B9'

export function PublicProfilePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [totalApproved, setTotalApproved] = useState<number>(0)
  const [totalQuestions, setTotalQuestions] = useState<number>(0)
  const [loadingStats, setLoadingStats] = useState(true)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    const results = await Promise.allSettled([
      walletApi.getBalance(),
      questionApi.getMyStats(),
      questionApi.listMyQuestions({ limit: 1 }),
    ])
    const [balanceRes, statsRes, listRes] = results
    setWalletBalance(balanceRes.status === 'fulfilled' ? balanceRes.value.balance ?? 0 : 0)
    setTotalApproved(statsRes.status === 'fulfilled' ? statsRes.value.totalApproved ?? 0 : 0)
    setTotalQuestions(listRes.status === 'fulfilled' ? listRes.value.total ?? 0 : 0)
    setLoadingStats(false)
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (!user) return null

  const initials = getInitials(user.name || '', user.mobileNumber)
  const approved = totalApproved ?? 0
  const tierIdx = currentTierIndex(approved)
  const tierCfg = TIER_DISPLAY[tierIdx]
  const nextTierIdx = tierIdx < REWARD_TIERS.length - 1 ? tierIdx + 1 : null
  const remaining = nextTierIdx != null ? Math.max(0, REWARD_TIERS[nextTierIdx].min - approved) : 0
  const progress = nextTierIdx != null
    ? Math.min(Math.max((approved - REWARD_TIERS[tierIdx].min) / (REWARD_TIERS[nextTierIdx].min - REWARD_TIERS[tierIdx].min), 0), 1)
    : 1

  const status = user.verificationStatus
  const statusCfg = status ? VERIFICATION_CONFIG[status] : null
  const cat = user.category
  const memberSince = formatDate(user.createdAt) || em

  const handleLogout = () => {
    setLogoutOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-20 sm:pb-6 lg:space-y-5 lg:pb-6">

      {/* ── 1. Hero card ── */}
      <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 shadow-lg">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        {/* Glow orbs */}
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl" />

        <div className="relative flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4 sm:p-5 lg:p-6">
          {/* Avatar */}
          <div className="relative shrink-0 self-center sm:self-auto">
            {status === 'verified' && (
              <div className="absolute inset-0 rounded-full animate-pulse bg-emerald-400/30 blur-sm" />
            )}
            <div className={cn(
              'relative flex h-16 w-16 items-center justify-center rounded-full text-xl font-extrabold sm:h-18 sm:w-18 lg:h-20 lg:w-20',
              'bg-white/15 text-white ring-[3px] ring-white/25 backdrop-blur-sm',
              status === 'verified' && 'ring-emerald-400/50',
            )}>
              {initials}
            </div>
            {status === 'verified' && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-emerald-900 bg-emerald-400 text-emerald-950 shadow-lg">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="truncate text-2xl font-black text-white sm:text-3xl lg:text-4xl">
              {user.name || em}
            </h1>
            {user.mobileNumber && (
              <div className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-emerald-300/70 sm:justify-start sm:text-xs">
                <Phone className="h-3.5 w-3.5" />
                <span>{user.mobileNumber}</span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {cat && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm sm:text-xs">
                  <Leaf className="h-3.5 w-3.5" />
                  {categoryLabel(cat)}
                </span>
              )}
              {statusCfg && (
                <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold', statusCfg.classes)}>
                  <statusCfg.icon className="h-3 w-3" />
                  {t(statusCfg.label)}
                </span>
              )}
            </div>
            {user.state && (
              <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-emerald-300/60 sm:justify-start sm:text-xs">
                <MapPin className="h-3.5 w-3.5" />
                <span>{user.state}{user.district ? ` > ${user.district}` : ''}</span>
              </div>
            )}

            {/* Tier progress chip */}
            {!nextTierIdx ? (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[10px] font-bold text-amber-300 sm:text-xs">
                <Trophy className="h-3.5 w-3.5" />
                {t('home.gold')} — highest rewards unlocked!
              </div>
            ) : (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-700"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-amber-300 sm:text-xs">
                  {remaining} to {t(`home.${TIER_DISPLAY[nextTierIdx].key}`)}
                </span>
              </div>
            )}
          </div>

          {/* Tier badge */}
          <div className="hidden sm:flex shrink-0 flex-col items-center gap-1">
            <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg', tierCfg.bgClass)}>
              <Leaf className="h-7 w-7 text-white" />
            </div>
            <p className={cn('text-[10px] font-black uppercase tracking-widest sm:text-xs', tierCfg.textClass)}>
              {t(`home.${tierCfg.key}`)}
            </p>
            <p className="text-[10px] text-emerald-400/60">Current tier</p>
          </div>
        </div>
      </div>

      {/* ── 2. Tier card ── */}
      <Card className="overflow-hidden" style={{ borderTop: `3px solid ${tierCfg.color}` }}>
        <CardContent className="space-y-3 p-4 sm:p-5">
          {/* Header row */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: tierCfg.color + '22' }}>
              <Medal className="h-5 w-5" style={{ color: tierCfg.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold sm:text-lg" style={{ color: tierCfg.color }}>
                {t(`home.${tierCfg.key}`)} {t('profile.member')}
              </p>
              <p className="text-[11px] font-medium text-text-secondary sm:text-xs">
                {approved} approved questions
              </p>
            </div>
            {nextTierIdx && (
              <div className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ backgroundColor: tierCfg.color + '1a', color: tierCfg.color }}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M4 1L7 4L4 7M1 4H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {remaining} to next
              </div>
            )}
          </div>

          {/* Progress bar */}
          {nextTierIdx ? (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: tierCfg.color }} />
              </div>
              <div className="flex items-center justify-between text-[11px] font-medium text-text-tertiary">
                <span>{t('profile.moreToNextTier', { count: remaining, tier: t(`home.${TIER_DISPLAY[nextTierIdx].key}`) })}</span>
                <span className="font-bold" style={{ color: tierCfg.color }}>{REWARD_TIERS[nextTierIdx].min} pts</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-lg py-2" style={{ backgroundColor: tierCfg.color + '1a', color: tierCfg.color }}>
              <Trophy className="h-4 w-4" />
              <span className="text-xs font-bold">{t('profile.maxTierReached', "Highest tier reached!")}</span>
            </div>
          )}

          {/* Tier steps */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-subtle">
            {TIER_DISPLAY.map((tier, idx) => {
              const reached = approved >= REWARD_TIERS[idx].min
              return (
                <div key={tier.key} className="flex flex-col items-center gap-1 text-center">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2"
                    style={{
                      backgroundColor: reached ? tier.color : 'transparent',
                      borderColor: reached ? 'transparent' : '#94a3b8',
                    }}
                  >
                    {reached
                      ? <CheckCircle2 className="h-4 w-4 text-white" />
                      : <span className="text-[10px] font-bold text-text-tertiary">{idx + 1}</span>
                    }
                  </div>
                  <p className="text-[11px] font-bold" style={{ color: reached ? tier.color : undefined }}>
                    {t(`home.${tier.key}`)}
                  </p>
                  <p className="text-[10px] text-text-tertiary">{REWARD_TIERS[idx].min}+</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Stats row ── */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <StatTile icon={Wallet} value={`${rupee}${walletBalance}`} label={t('profile.wallet')} loading={loadingStats} />
        <StatTile icon={HelpCircle} value={String(totalQuestions)} label={t('profile.questions')} loading={loadingStats} />
        <StatTile icon={Calendar} value={memberSince} label={t('profile.memberSince')} />
      </div>

      {/* ── 4. Account section ── */}
      <section className="space-y-4">
        <SectionHeader icon={Users} title={t('profile.account')} />

        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap">

          {/* Personal Info */}
          <AccountCard icon={Users} title={t('profile.personalInfo')} className="lg:flex-1 lg:basis-[320px]">
            {(user.username != null || cat || user.gender || user.age != null) ? (
              <>
                {user.username != null && <AccountRow icon={AtSign} label={t('profile.username')} value={`@${user.username}`} />}
                {cat && <AccountRow icon={Tag} label={t('profile.category')} value={categoryLabel(cat)} />}
                {user.gender && <AccountRow icon={Users} label={t('profile.gender')} value={<span className="capitalize">{user.gender}</span>} />}
                {user.age != null && <AccountRow icon={CalendarDays} label={t('profile.age')} value={`${user.age} ${t('profile.years')}`} isLast />}
              </>
            ) : (
              <p className="px-4 py-3 text-xs text-text-tertiary">No personal info set.</p>
            )}
          </AccountCard>

          {/* Location */}
          {(user.state || user.district || user.block || user.village || user.kvk) && (
            <AccountCard icon={MapPin} title={t('profile.location')} className="lg:flex-1 lg:basis-[320px]">
              <>
                {user.state && <AccountRow icon={MapPin} label={t('profile.state')} value={user.state} />}
                {user.district && <AccountRow icon={Building2} label={t('profile.district')} value={user.district} />}
                {user.block && <AccountRow icon={MapPinned} label={t('profile.block')} value={user.block} />}
                {user.village && <AccountRow icon={Home} label={t('profile.village')} value={user.village} />}
                {user.kvk && <AccountRow icon={School} label={t('profile.kvk')} value={user.kvk} isLast />}
              </>
            </AccountCard>
          )}

          {/* Education — students */}
          {cat === 'student' && (user.courseName || user.collegeName || user.universityName) && (
            <AccountCard icon={GraduationCap} title={t('profile.education')} className="lg:flex-1 lg:basis-[320px]">
              <>
                {user.courseName && <AccountRow icon={BookOpen} label={t('profile.course')} value={user.courseName} />}
                {user.collegeName && <AccountRow icon={School} label={t('profile.college')} value={user.collegeName} />}
                {user.universityName && <AccountRow icon={GraduationCap} label={t('profile.university')} value={user.universityName} isLast />}
              </>
            </AccountCard>
          )}

          {/* Organization — FPO / NGO */}
          {(cat === 'fpo' || cat === 'ngo') &&
            (user.organizationName || user.organisationType || user.organizationRole || user.numberOfFarmers != null) && (
              <AccountCard icon={Briefcase} title={t('profile.organisationDetails')} className="lg:flex-1 lg:basis-[320px]">
                <>
                  {user.organizationName && <AccountRow icon={Briefcase} label={t('profile.orgName')} value={user.organizationName} />}
                  {user.organisationType && <AccountRow icon={Tag} label={t('profile.orgType')} value={user.organisationType} />}
                  {user.organizationRole && <AccountRow icon={Users} label={t('profile.orgRole')} value={user.organizationRole} />}
                  {user.numberOfFarmers != null && <AccountRow icon={Users} label={t('profile.members')} value={String(user.numberOfFarmers)} isLast />}
                </>
              </AccountCard>
            )}

          {/* Organization Location — FPO / NGO */}
          {(cat === 'fpo' || cat === 'ngo') &&
            ((user.organizationState && user.organizationState.length > 0) ||
              user.organizationDistrict || user.organizationBlock || user.organizationVillage) && (
              <AccountCard icon={MapPin} title={t('profile.organisationLocation')} className="lg:flex-1 lg:basis-[320px]">
                <>
                  {user.organizationState && user.organizationState.length > 0 && (
                    <AccountRow
                      icon={MapPin}
                      label={t('profile.state')}
                      value={user.organizationState.join(', ')}
                    />
                  )}
                  {user.organizationDistrict && <AccountRow icon={Building2} label={t('profile.district')} value={user.organizationDistrict} />}
                  {user.organizationBlock && <AccountRow icon={MapPinned} label={t('profile.block')} value={user.organizationBlock} />}
                  {user.organizationVillage && <AccountRow icon={Home} label={t('profile.village')} value={user.organizationVillage} isLast />}
                </>
              </AccountCard>
            )}

          {/* Farming — farmers only */}
          {cat === 'farmer' && (user.farmSize || user.cropType || user.season) && (
            <AccountCard icon={Sprout} title={t('profile.farming')} className="lg:flex-1 lg:basis-[320px]">
              <>
                {user.farmSize && <AccountRow icon={Ruler} label={t('profile.farmSize')} value={`${user.farmSize} ${t('profile.acres')}`} />}
                {user.cropType && <AccountRow icon={Sprout} label={t('profile.crop')} value={user.cropType} isLast={!user.season} />}
                {user.season && <AccountRow icon={Calendar} label={t('profile.season')} value={user.season} isLast />}
              </>
            </AccountCard>
          )}
        </div>

        {/* Crop chips */}
        {user.cropType && (
          <div className="flex flex-wrap gap-2">
            {user.cropType.split(',').map(c => (
              <span key={c} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                <Leaf className="h-3 w-3" />
                {c.trim()}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Actions section ── */}
      <section>
        <SectionHeader icon={Trophy} title={t('profile.actions')} />
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ActionRow icon={Wallet} label={t('profile.paymentMethods')} onClick={() => navigate('/home/payment-methods')} />
            <ActionRow icon={Flag} label={t('report.title')} onClick={() => navigate('/home/reports')} />
            <ActionRow icon={HelpCircle} label={t('profile.helpAndFeedback')} onClick={() => navigate('/home/faqs')} />
            <ActionRow icon={FileText} label={t('profile.termsOfService')} onClick={() => navigate('/home/terms')} />
            <ActionRow icon={ShieldCheck} label={t('profile.privacyPolicy')} onClick={() => navigate('/home/privacy')} />
            <ActionRow
              icon={MessageSquarePlus}
              label={t('profile.contactAdmin')}
              onClick={() => {
                const email = (import.meta as any).env?.VITE_SUPPORT_EMAIL as string | undefined
                if (!email) { toast.error('Support email not configured.'); return }
                window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent('AnnaDatha Support')}`, '_blank', 'noopener,noreferrer')
              }}
            />
          </CardContent>
        </Card>
      </section>

      {/* ── 6. Sign Out ── */}
      <button
        type="button"
        onClick={() => setLogoutOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
      >
        <LogOut className="h-4 w-4" />
        {t('profile.signOut')}
      </button>

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <div className="h-px flex-1 bg-border-subtle" />
        <p className="px-3 text-center text-[11px] text-text-tertiary">AnnaDatha — To Strengthen Indian Farmers</p>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>

      {/* ── Logout dialog ── */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-rose-50 to-white px-6 pt-6 pb-5 dark:from-rose-950/40 dark:to-surface">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50">
              <LogOut className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-foreground sm:text-xl">
              {t('profile.signOut')}?
            </DialogTitle>
            <p className="text-center text-sm text-text-secondary">{t('profile.signOutConfirm')}</p>
          </div>
          <div className="flex flex-col gap-2 px-6 pb-6 pt-1 sm:flex-row sm:pt-2">
            <Button variant="outline" onClick={() => setLogoutOpen(false)} className="flex-1 justify-center">
              {t('editProfile.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleLogout} className="flex-1 justify-center gap-2">
              <LogOut className="h-4 w-4" />
              {t('profile.signOutAction')}
            </Button>
          </div>
          <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-focus sm:right-4 sm:top-4">
            <X className="h-4 w-4 text-text-tertiary" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogContent>
      </Dialog>
    </div>
  )
}