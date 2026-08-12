/**
 * Public Profile Page — mirrors mobile/src/screens/Profile/ProfileScreen.tsx
 *
 * Visual hierarchy (top → bottom):
 *   1. Hero card ──────────── avatar (60x60 w/ verified badge), name, phone, category badge, verification pill
 *   2. Tier card ──────────── medal icon, "X Member" title, "X approved questions", "Y to Next" pill,
 *                             progress bar, milestones (Bronze/Silver/Gold with checkmarks)
 *   3. Stats row ──────────── Wallet / Questions / Member Since (3 small tiles)
 *   4. Account section ────── Personal Info / Location / Education (student) / Organization (fpo/ngo)
 *                             + Organization Location (fpo/ngo)
 *   5. Farming card ──────── Farm Size / Crop / Season (farmers only)
 *   6. Crops chips ───────── chip-style tags (any category, if user.cropType set)
 *   7. Actions section ────── Payment Methods / Report / Help & Feedback / Terms / Privacy / Contact Admin
 *   8. Sign Out ─────────── red button with confirm dialog
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { authApi, questionApi, walletApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Phone, Leaf, Wallet, Calendar, Trophy, Medal,
  CheckCircle2, Clock, Eye, AlertCircle, XCircle,
  AtSign, Tag, Users, MapPin, Building2, MapPinned, Home, School,
  ChevronRight, Pencil, LogOut, Flag, ShieldCheck,
  FileText, MessageSquarePlus, BookOpen, GraduationCap, Briefcase,
  CalendarDays, Sprout, Ruler, Loader2, Save, HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { LANGUAGES, categoryLabel } from '@/constants/public'
import { cn, getInitials, formatDate } from '@/lib/utils'
import type { VerificationStatus } from '@/types'

// — Tier config (mirrors mobile ProfileScreen TIER_CONFIG + REWARD_TIERS) —
const TIER_CONFIG = {
  bronze: { color: '#CD7F32', label: 'Bronze', next: 'Silver', threshold: 0,   nextThreshold: 26  },
  silver: { color: '#A8A8A8', label: 'Silver', next: 'Gold',   threshold: 26,  nextThreshold: 251 },
  gold:   { color: '#F59E0B', label: 'Gold',   next: null,    threshold: 251, nextThreshold: Number.POSITIVE_INFINITY },
} as const

type Tier = keyof typeof TIER_CONFIG

function getRewardTier(approved: number): Tier {
  if (approved >= TIER_CONFIG.gold.threshold) return 'gold'
  if (approved >= TIER_CONFIG.silver.threshold) return 'silver'
  return 'bronze'
}

// — Verification status pill config ———————————————————————————————————
interface StatusConfig {
  label: string
  icon: typeof CheckCircle2
  classes: string
}
const VERIFICATION_CONFIG: Record<VerificationStatus, StatusConfig> = {
  verified: {
    label: 'Verified',
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800',
  },
  manual_review: {
    label: 'In Review',
    icon: Eye,
    classes: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800',
  },
  suspended: {
    label: 'Suspended',
    icon: AlertCircle,
    classes: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800',
  },
  banned: {
    label: 'Banned',
    icon: XCircle,
    classes: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800',
  },
}

// — Inline sub-components ———————————————————————————————————

interface SectionHeaderProps {
  icon: typeof CheckCircle2
  title: string
  trailing?: ReactNode
}
function SectionHeader({ icon: Icon, title, trailing }: SectionHeaderProps) {
  return (
    <div className="mb-2.5 flex items-center gap-2 px-1">
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <h3 className="flex-1 text-sm font-bold text-foreground">{title}</h3>
      {trailing}
    </div>
  )
}

interface AccountCardProps {
  icon: typeof CheckCircle2
  title: string
  children: ReactNode
}
function AccountCard({ icon: Icon, title, children }: AccountCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Icon className="h-3.5 w-3.5 text-emerald-600" />
        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          {title}
        </h4>
      </div>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  )
}

interface AccountRowProps {
  icon: typeof CheckCircle2
  label: string
  value: ReactNode
  isLast?: boolean
  onClick?: () => void
}
function AccountRow({ icon: Icon, label, value, isLast, onClick }: AccountRowProps) {
  const interactive = !!onClick
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
        <span className="truncate text-sm font-medium text-text-tertiary">{label}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1 text-right">
        <span className="truncate text-sm font-semibold text-foreground">
          {value || <span className="text-text-tertiary">{em}</span>}
        </span>
        {interactive && <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />}
      </div>
    </>
  )
  const baseClasses = cn(
    'flex items-center justify-between gap-3 px-4 py-4',
    !isLast && 'border-b border-slate-100 dark:border-slate-800',
    interactive && 'transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50',
  )
  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={cn(baseClasses, 'w-full text-left')}>
        {content}
      </button>
    )
  }
  return <div className={baseClasses}>{content}</div>
}

interface ActionRowProps {
  icon: typeof CheckCircle2
  label: string
  onClick: () => void
}
function ActionRow({ icon: Icon, label, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm font-semibold text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-text-tertiary" />
    </button>
  )
}

interface StatTileProps {
  icon: typeof CheckCircle2
  value: string
  label: string
  loading?: boolean
}
function StatTile({ icon: Icon, value, label, loading }: StatTileProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1 p-3">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        ) : (
          <Icon className="h-4 w-4 text-emerald-600" />
        )}
        <p className="text-sm font-extrabold leading-tight text-foreground">{value}</p>
        <p className="text-[10px] font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      </CardContent>
    </Card>
  )
}

interface CropChipProps {
  name: string
}
function CropChip({ name }: CropChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
      <Leaf className="h-3 w-3" />
      {name}
    </span>
  )
}

// — Main page ——————————————————————————————————————————————————————

export function PublicProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()

  // Data state
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [totalApproved, setTotalApproved] = useState<number | null>(null)
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Edit + logout state
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [languagePreference, setLanguagePreference] = useState('en')
  const [logoutOpen, setLogoutOpen] = useState(false)

  // Fetch wallet balance, approved stats, and total question count in parallel.
  // Mount/unmount on route change naturally re-runs this; the effect deps are
  // stable callbacks so a strict-mode double-mount is harmless.
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

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  if (!user) return null

  // Localized glyphs (declared once to keep JSX expressions tidy)
  const em = '\u2014' // —
  const rupee = '\u20B9' // ₹

  // Derived values
  const initials = getInitials(user.name || '', user.mobileNumber)
  const approved = totalApproved ?? 0
  const tier = getRewardTier(approved)
  const tierCfg = TIER_CONFIG[tier]
  const nextThreshold = tierCfg.nextThreshold
  const remaining = nextThreshold === Number.POSITIVE_INFINITY ? 0 : Math.max(0, nextThreshold - approved)
  const progress = nextThreshold === Number.POSITIVE_INFINITY
    ? 1
    : Math.min(Math.max((approved - tierCfg.threshold) / (nextThreshold - tierCfg.threshold), 0), 1)

  const status = user.verificationStatus
  const statusCfg = status ? VERIFICATION_CONFIG[status] : null
  const cat = user.category

  const memberSince = formatDate(user.createdAt) || em
  const cropList = user.cropType
    ? user.cropType.split(',').map((c) => c.trim()).filter(Boolean)
    : []

  // — Handlers —
  function startEdit() {
    setName(user?.name || '')
    setLanguagePreference(user?.languagePreference || 'en')
    setEditing(true)
  }

  async function save() {
    if (!name.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    setSaving(true)
    try {
      const { user: fresh } = await authApi.updateMe({ name: name.trim(), languagePreference })
      updateUser(fresh)
      toast.success('Profile updated')
      setEditing(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save changes.'))
    } finally {
      setSaving(false)
    }
  }

  function handleLogout() {
    setLogoutOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  function handleReport() {
    navigate('/public/reports')
  }
  function handleTerms() {
    toast.info('Terms of Service — coming soon to the web app')
  }
  function handlePrivacy() {
    toast.info('Privacy Policy — coming soon to the web app')
  }
  function handleContact() {
    window.location.href = 'mailto:support@annadatha.app?subject=AnnaDatha%20Support'
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      {/* — 1. Hero card ———————————————————————————————————————— */}
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Avatar with ring + verified badge */}
            <div className="relative shrink-0">
              <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-emerald-100 p-0.5 dark:border-emerald-900/50">
                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-lg font-extrabold text-white">
                  {initials}
                </div>
              </div>
              {status === 'verified' && (
                <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white dark:border-slate-900">
                  <CheckCircle2 className="h-3 w-3" />
                </div>
              )}
            </div>

            {/* Name + meta */}
            <div className="min-w-0 flex-1 space-y-0.5">
              <h2 className="truncate text-lg font-extrabold text-foreground">
                {user.name || em}
              </h2>
              {user.mobileNumber && (
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Phone className="h-3 w-3" />
                  <span>{user.mobileNumber}</span>
                </div>
              )}
              {cat && (
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <Leaf className="h-2.5 w-2.5" />
                  <span>{categoryLabel(cat)}</span>
                </div>
              )}
            </div>

            {/* Verification pill */}
            {statusCfg && (
              <div className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold', statusCfg.classes)}>
                <statusCfg.icon className="h-2.5 w-2.5" />
                <span>{statusCfg.label}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* — 2. Tier card ———————————————————————————————————————— */}
      <Card className="overflow-hidden">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: tierCfg.color + '20' }}
            >
              <Medal className="h-5 w-5" style={{ color: tierCfg.color }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold" style={{ color: tierCfg.color }}>
                {tierCfg.label} Member
              </p>
              <p className="text-xs font-medium text-text-secondary">
                {approved} approved questions
              </p>
            </div>
            {tier !== 'gold' && (
              <div
                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                style={{ backgroundColor: tierCfg.color + '18', color: tierCfg.color }}
              >
                {remaining} to {tierCfg.next}
              </div>
            )}
          </div>

          {tier !== 'gold' && (
            <div className="space-y-1">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: tierCfg.color + '20' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: Math.round(progress * 100) + '%', backgroundColor: tierCfg.color }}
                />
              </div>
              <p className="text-center text-[11px] font-medium text-text-tertiary">
                {remaining} more to {tierCfg.next}
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {(['bronze', 'silver', 'gold'] as Tier[]).map((t) => {
              const tcfg = TIER_CONFIG[t]
              const reached = approved >= tcfg.threshold
              return (
                <div key={t} className="flex flex-col items-center gap-1">
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ backgroundColor: reached ? tcfg.color : '#e2e8f0' }}
                  >
                    {reached && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                  <p
                    className="text-[11px] font-bold"
                    style={{ color: reached ? tcfg.color : undefined }}
                  >
                    {tcfg.label}
                  </p>
                  <p className="text-[10px] font-medium text-text-tertiary">{tcfg.threshold}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* — 3. Stats row ————————————————————————————————————— */}
      <div className="grid grid-cols-3 gap-2.5">
        <StatTile
          icon={Wallet}
          value={rupee + (walletBalance ?? 0)}
          label="Wallet"
          loading={loadingStats}
        />
        <StatTile
          icon={HelpCircle}
          value={totalQuestions == null ? em : String(totalQuestions)}
          label="Questions"
          loading={loadingStats}
        />
        <StatTile
          icon={Calendar}
          value={memberSince}
          label="Member Since"
        />
      </div>

      {/* — 4. Account section —————————————————————— */}
      <section className="space-y-4">
        <SectionHeader
          icon={Users}
          title="Account"
          trailing={
            <button
              type="button"
              onClick={startEdit}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
            >
              <Pencil className="h-3 w-3" />
              <span>Edit</span>
            </button>
          }
        />

        {/* Personal Info */}
        <AccountCard icon={Users} title="Personal Info">
          <div className="border-t border-slate-100 dark:border-slate-800">
            {user.username != null && (
              <AccountRow icon={AtSign} label="Username" value={String('@') + user.username} />
            )}
            {cat && <AccountRow icon={Tag} label="Category" value={categoryLabel(cat)} />}
            {user.gender && (
              <AccountRow
                icon={Users}
                label="Gender"
                value={<span className="capitalize">{user.gender}</span>}
              />
            )}
            {user.age != null && (
              <AccountRow
                icon={CalendarDays}
                label="Age"
                value={user.age + ' yrs'}
                isLast
              />
            )}
          </div>
        </AccountCard>

        {/* Location */}
        {(user.state || user.district || user.block || user.village || user.kvk) && (
          <AccountCard icon={MapPin} title="Location">
            <div className="border-t border-slate-100 dark:border-slate-800">
              {user.state && <AccountRow icon={MapPin} label="State" value={user.state} />}
              {user.district && (
                <AccountRow icon={Building2} label="District" value={user.district} />
              )}
              {user.block && (
                <AccountRow icon={MapPinned} label="Block" value={user.block} />
              )}
              {user.village && (
                <AccountRow icon={Home} label="Village" value={user.village} />
              )}
              {user.kvk && (
                <AccountRow icon={School} label="KVK" value={user.kvk} isLast />
              )}
            </div>
          </AccountCard>
        )}

        {/* Education — students only */}
        {cat === 'student' && (user.courseName || user.collegeName || user.universityName) && (
          <AccountCard icon={GraduationCap} title="Education">
            <div className="border-t border-slate-100 dark:border-slate-800">
              {user.courseName && (
                <AccountRow icon={BookOpen} label="Course" value={user.courseName} />
              )}
              {user.collegeName && (
                <AccountRow icon={School} label="College" value={user.collegeName} />
              )}
              {user.universityName && (
                <AccountRow
                  icon={GraduationCap}
                  label="University"
                  value={user.universityName}
                  isLast
                />
              )}
            </div>
          </AccountCard>
        )}

        {/* Organization — FPO / NGO only */}
        {(cat === 'fpo' || cat === 'ngo') &&
          (user.organizationName ||
            user.organisationType ||
            user.organizationRole ||
            user.numberOfFarmers != null) && (
            <AccountCard icon={Briefcase} title="Organization">
              <div className="border-t border-slate-100 dark:border-slate-800">
                {user.organizationName && (
                  <AccountRow icon={Briefcase} label="Name" value={user.organizationName} />
                )}
                {user.organisationType && (
                  <AccountRow icon={Tag} label="Type" value={user.organisationType} />
                )}
                {user.organizationRole && (
                  <AccountRow
                    icon={Users}
                    label="Your role"
                    value={user.organizationRole}
                  />
                )}
                {user.numberOfFarmers != null && (
                  <AccountRow
                    icon={Users}
                    label="Farmers reached"
                    value={String(user.numberOfFarmers)}
                    isLast
                  />
                )}
              </div>
            </AccountCard>
          )}

        {/* Organization Location — FPO / NGO only */}
        {(cat === 'fpo' || cat === 'ngo') &&
          (user.organizationState ||
            user.organizationDistrict ||
            user.organizationBlock ||
            user.organizationVillage) && (
            <AccountCard icon={MapPin} title="Organization Location">
              <div className="border-t border-slate-100 dark:border-slate-800">
                {user.organizationState && (
                  <AccountRow icon={MapPin} label="State" value={user.organizationState} />
                )}
                {user.organizationDistrict && (
                  <AccountRow
                    icon={Building2}
                    label="District"
                    value={user.organizationDistrict}
                  />
                )}
                {user.organizationBlock && (
                  <AccountRow
                    icon={MapPinned}
                    label="Block"
                    value={user.organizationBlock}
                  />
                )}
                {user.organizationVillage && (
                  <AccountRow
                    icon={Home}
                    label="Village"
                    value={user.organizationVillage}
                    isLast
                  />
                )}
              </div>
            </AccountCard>
          )}
      </section>

      {/* — 5. Farming card (farmers only) ————————— */}
      {cat === 'farmer' && (user.farmSize || user.cropType || user.season) && (
        <AccountCard icon={Sprout} title="Farming">
          <div className="border-t border-slate-100 dark:border-slate-800">
            {user.farmSize && (
              <AccountRow
                icon={Ruler}
                label="Farm Size"
                value={user.farmSize + ' acres'}
              />
            )}
            {user.cropType && (
              <AccountRow
                icon={Sprout}
                label="Crop"
                value={user.cropType}
                isLast={!user.season}
              />
            )}
            {user.season && (
              <AccountRow icon={Calendar} label="Season" value={user.season} isLast />
            )}
          </div>
        </AccountCard>
      )}

      {/* — 6. Crops chips (any category, if cropType set) — */}
      {cropList.length > 0 && (
        <section>
          <SectionHeader icon={Sprout} title="Crops" />
          <div className="flex flex-wrap gap-1.5">
            {cropList.map((c) => (
              <CropChip key={c} name={c} />
            ))}
          </div>
        </section>
      )}

      {/* — 7. Actions section ——————————————————— */}
      <section>
        <SectionHeader icon={Trophy} title="Actions" />
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <ActionRow
              icon={Wallet}
              label="Payment Methods"
              onClick={() => navigate('/public/payment-methods')}
            />
            <ActionRow icon={Flag} label="Report an Issue" onClick={handleReport} />
            <ActionRow
              icon={HelpCircle}
              label="Help & Feedback"
              onClick={() => navigate('/public/faqs')}
            />
            <ActionRow icon={FileText} label="Terms of Service" onClick={handleTerms} />
            <ActionRow icon={ShieldCheck} label="Privacy Policy" onClick={handlePrivacy} />
            <ActionRow icon={MessageSquarePlus} label="Contact Admin" onClick={handleContact} />
          </CardContent>
        </Card>
      </section>

      {/* — 8. Sign Out ———————————————————————————————————— */}
      <button
        type="button"
        onClick={() => setLogoutOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
      >
        <LogOut className="h-4 w-4" />
        Sign Out
      </button>

      <p className="pt-2 text-center text-xs text-text-tertiary">
        AnnaDatha — Made for Indian farmers
      </p>

      {/* — Edit profile dialog ————————————————————————————— */}
      <Dialog open={editing} onOpenChange={(v) => !saving && setEditing(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Update your display name and preferred language.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-lang">Preferred language</Label>
              <Select value={languagePreference} onValueChange={setLanguagePreference}>
                <SelectTrigger id="profile-lang">
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* — Logout confirmation dialog ———————————————— */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Out?</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out of your AnnaDatha account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
