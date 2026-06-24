import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserDetailSkeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DataTable, CardView,
  ViewToggle, type ColumnDef,
} from '@/components/DataTable'
import { cn, formatDate, formatDateTime, getInitials } from '@/lib/utils'
import {
  ArrowLeft, Ban, PauseCircle, PlayCircle, CheckCircle,
  ShieldCheck, MapPin, Phone, Calendar, MessageSquare,
  Clock, FileText, Image, ChevronDown, ScrollText, ChevronRight, ChevronLeft,
  Wallet, CreditCard, Building2, Smartphone,
} from 'lucide-react'
import { toast } from 'sonner'
import type { User as UserType, Question, QuestionStatus, AuditLogEntry, PaymentDetail } from '@/types'
import { auditApi } from '@/api/client'

// ─── Status badge helpers ──────────────────────────────────────────────────────

function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    verified:      { label: 'Verified',      cls: 'bg-emerald-500 text-white' },
    pending:       { label: 'Pending Review', cls: 'bg-amber-500 text-white' },
    manual_review: { label: 'Manual Review', cls: 'bg-blue-500 text-white' },
    suspended:     { label: 'Suspended',     cls: 'bg-amber-500 text-white' },
    banned:        { label: 'Banned',        cls: 'bg-red-600 text-white' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-muted' }
  return <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', cls)}>{label}</span>
}

function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  const map: Record<QuestionStatus, { label: string; dot: string; cls: string }> = {
    pending:      { label: 'Pending',      dot: 'bg-amber-500',  cls: 'text-amber-600' },
    ai_review:    { label: 'AI Review',    dot: 'bg-blue-500',   cls: 'text-blue-600' },
    human_review: { label: 'Human Review', dot: 'bg-purple-500', cls: 'text-purple-600' },
    held:         { label: 'Held',          dot: 'bg-orange-400', cls: 'text-orange-500' },
    approved:     { label: 'Approved',     dot: 'bg-emerald-500',  cls: 'text-emerald-600' },
    rejected:     { label: 'Rejected',     dot: 'bg-red-600', cls: 'text-red-600' },
  }
  const { label, dot, cls } = map[status] ?? { label: status, dot: 'bg-muted', cls: 'text-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; dot: string; cls: string }> = {
    pending:      { label: 'Pending',      dot: 'bg-amber-500',  cls: 'text-amber-600' },
    in_progress:  { label: 'In Progress',  dot: 'bg-blue-500',   cls: 'text-blue-600' },
    verified:     { label: 'Verified',     dot: 'bg-emerald-500',cls: 'text-emerald-600' },
    failed:       { label: 'Failed',       dot: 'bg-red-600',    cls: 'text-red-600' },
  }
  const { label, dot, cls } = map[status] ?? { label: status, dot: 'bg-muted', cls: 'text-muted-foreground' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  )
}

// ─── Stats strip ───────────────────────────────────────────────────────────────

function StatsStrip({ questions }: { questions: Question[] }) {
  const counts = useMemo(() => ({
    total: questions.length,
    approved: questions.filter((q) => q.status === 'approved').length,
    rejected: questions.filter((q) => q.status === 'rejected').length,
    pending: questions.filter((q) => ['pending', 'ai_review', 'human_review'].includes(q.status)).length,
  }), [questions])

  const items = [
    { label: 'Total Questions', value: counts.total, icon: FileText, bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400' },
    { label: 'Approved', value: counts.approved, icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Pending', value: counts.pending, icon: Clock, bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400' },
    { label: 'Rejected', value: counts.rejected, icon: Ban, bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-600 dark:text-red-400' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, icon: Icon, bg, text }) => (
        <Card key={label} className={cn('border-0', bg)}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className={cn('mt-1 text-2xl font-extrabold', text)}>{value}</p>
            </div>
            <Icon className={cn('h-6 w-6 opacity-60', text)} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Questions table columns ───────────────────────────────────────────────────

function buildQuestionColumns(): ColumnDef<Question>[] {
  return [
    {
      key: 'questionText',
      header: 'Question',
      width: '280px',
      sortable: true,
      render: (q) => (
        <span className="text-sm text-foreground line-clamp-2 leading-relaxed">{q.questionText}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      sortable: true,
      render: (q) => <QuestionStatusBadge status={q.status} />,
    },
    {
      key: 'domains',
      header: 'Category',
      width: '180px',
      sortable: true,
      filterable: true,
      filterOptions: [],  // derived from data
      render: (q) => (
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">
          {(q.domains ?? []).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'season',
      header: 'Season',
      width: '90px',
      sortable: true,
      filterable: true,
      filterOptions: [],
      render: (q) => (
        <span className="text-xs text-muted-foreground capitalize">{q.season || '—'}</span>
      ),
    },
    {
      key: 'cropType',
      header: 'Crop',
      width: '100px',
      sortable: true,
      render: (q) => (
        <span className="text-xs text-muted-foreground capitalize">{q.cropType || '—'}</span>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      width: '110px',
      sortable: true,
      render: (q) => (
        <span className="text-xs text-muted-foreground">{formatDate(q.submittedAt) ?? '—'}</span>
      ),
    },
    {
      key: 'mediaUrls',
      header: 'Media',
      width: '80px',
      render: (q) =>
        q.mediaUrls && q.mediaUrls.length > 0 ? (
          <a
            href={q.mediaUrls[0]}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Image className="h-3 w-3" />
            {q.mediaUrls.length > 1 ? `${q.mediaUrls.length}` : ''}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ]
}

function buildQuestionCardColumns(): ColumnDef<Question>[] {
  return [
    {
      key: 'questionText',
      header: 'Question',
      render: (q) => (
        <span className="text-sm font-medium text-foreground line-clamp-2">{q.questionText}</span>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      render: (q) => (
        <span className="text-xs text-muted-foreground">{formatDate(q.submittedAt) ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (q) => <QuestionStatusBadge status={q.status} />,
    },
    {
      key: 'domains',
      header: 'Category',
      render: (q) => (
        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded capitalize">
          {(q.domains ?? []).join(', ') || '—'}
        </span>
      ),
    },

    {
      key: 'season',
      header: 'Season',
      render: (q) => (
        <span className="text-xs text-muted-foreground capitalize">{q.season || '—'}</span>
      ),
    },
    {
      key: 'cropType',
      header: 'Crop',
      render: (q) => <span className="text-xs text-muted-foreground capitalize">{q.cropType || '—'}</span>,
    },
  ]
}

// ─── Account detail rows ───────────────────────────────────────────────────────

interface DetailRowProps { label: string; value: React.ReactNode }
function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-foreground text-right max-w-[180px] truncate capitalize">
        {value}
      </span>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [user, setUser] = useState<UserType | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [accountCollapsed, setAccountCollapsed] = useState(true)
  const [paymentCollapsed, setPaymentCollapsed] = useState(false)
  const [suspendModalOpen, setSuspendModalOpen] = useState(false)
  const [suspendAction, setSuspendAction] = useState<'suspend' | 'ban'>('suspend')
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendUntil, setSuspendUntil] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'unsuspend' | 'unban'>('unsuspend')

  // Audit history (super_admin only)
  const [auditCollapsed, setAuditCollapsed] = useState(true)
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditPage, setAuditPage] = useState(1)
  const AUDIT_PAGE_SIZE = 10

  // Questions view state
  const [qView, setQView] = useState<'table' | 'card'>('table')
  const [qSearch, setQSearch] = useState('')
  const [qPage, setQPage] = useState(1)
  const Q_PAGE_SIZE = 10
  const Q_CARD_PAGE_SIZE = 9

  const tableColumns = useMemo(() => buildQuestionColumns(), [])
  const cardColumns = useMemo(() => buildQuestionCardColumns(), [])

  // Filtered + paginated questions
  const filteredQuestions = useMemo(() => {
    if (!qSearch.trim()) return questions
    const term = qSearch.toLowerCase()
    return questions.filter((q) =>
      q.questionText.toLowerCase().includes(term) ||
      (q.domains ?? []).join(' ').toLowerCase().includes(term) ||
      q.cropType.toLowerCase().includes(term) ||
      q.status.includes(term)
    )
  }, [questions, qSearch])

  const activePageSize = qView === 'card' ? Q_CARD_PAGE_SIZE : Q_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / activePageSize))
  const paginatedQuestions = useMemo(
    () => filteredQuestions.slice((qPage - 1) * activePageSize, qPage * activePageSize),
    [filteredQuestions, qPage, activePageSize]
  )

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    adminApi.getUserDetail(userId)
      .then((res) => {
        setUser(res.user as UserType)
        setQuestions(res.questions as Question[])
        setPaymentDetails((res as any).paymentDetails ?? [])
      })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load user')))
      .finally(() => setLoading(false))
  }, [userId])

  // Reset page when search changes
  useEffect(() => { setQPage(1) }, [qSearch])

  const isSuspended = user?.verificationStatus === 'suspended'
  const isBanned = user?.verificationStatus === 'banned'
  const isLocked = isSuspended || isBanned
  const isPending = user?.verificationStatus === 'pending'

  async function handleVerify() {
    if (!userId) return
    setActionLoading(true)
    try {
      await adminApi.verifyUser(userId)
      toast.success('User verified')
      const r = await adminApi.getUserDetail(userId)
      setUser(r.user as UserType)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to verify user'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSuspendBan() {
    if (!userId || !suspendReason.trim()) { toast.error('Please provide a reason'); return }
    setActionLoading(true)
    try {
      await adminApi.suspendUser(userId, { action: suspendAction, reason: suspendReason, suspendedUntil: suspendUntil || undefined })
      toast.success(suspendAction === 'ban' ? 'User banned' : 'User suspended')
      setSuspendModalOpen(false)
      const r = await adminApi.getUserDetail(userId)
      setUser(r.user as UserType)
    } catch (e) {
      toast.error(getErrorMessage(e, `Failed to ${suspendAction}`))
    } finally {
      setActionLoading(false)
    }
  }

  async function loadAuditHistory() {
    if (!userId) return
    if (auditEntries.length > 0) {
      setAuditCollapsed((c) => !c)
      return
    }
    setAuditLoading(true)
    try {
      const res = await auditApi.getEntityHistory('user', userId)
      setAuditEntries((res as AuditEntityHistoryResponse).entries)
      setAuditCollapsed(false)
      setAuditPage(1)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load audit history'))
    } finally {
      setAuditLoading(false)
    }
  }

  async function handleReinstate() {
    if (!userId) return
    setActionLoading(true)
    try {
      await adminApi.unsuspendUser(userId)
      toast.success(isBanned ? 'User unbanned' : 'Suspension lifted')
      setConfirmOpen(false)
      const r = await adminApi.getUserDetail(userId)
      setUser(r.user as UserType)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to reinstate'))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return <UserDetailSkeleton />
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">User not found</p>
        <Button variant="outline" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Button>
      </div>
    )
  }

  const initials = getInitials(user.name || '', user.mobileNumber)
  const avatarBg = isBanned ? 'bg-red-600' : isSuspended ? 'bg-amber-500' : 'bg-blue-600'

  return (
    <div className="space-y-5">
      {/* Back navigation */}
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </button>

      {/* Hero card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className={cn(
              'flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black text-white', avatarBg
            )}>
              {initials}
            </div>

            {/* Identity + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-foreground">{user.name || 'Unnamed User'}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <VerificationBadge status={user.verificationStatus} />
                    <Badge variant="secondary" className="capitalize">{user.role.replace('_', ' ')}</Badge>
                    {user.category && <Badge variant="outline" className="capitalize">{user.category}</Badge>}
                  </div>
                </div>

                {/* Action buttons — only for super_admin, never on self */}
                {isSuperAdmin && user.role !== 'super_admin' && (
                  <div className="flex flex-wrap gap-2">
                    {isPending && (
                      <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 gap-1.5 text-white" onClick={handleVerify} disabled={actionLoading}>
                        <CheckCircle className="h-4 w-4" /> Verify
                      </Button>
                    )}
                    {!isLocked && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
                          onClick={() => { setSuspendAction('suspend'); setSuspendModalOpen(true) }}>
                          <PauseCircle className="h-4 w-4" /> Suspend
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
                          onClick={() => { setSuspendAction('ban'); setSuspendModalOpen(true) }}>
                          <Ban className="h-4 w-4" /> Ban
                        </Button>
                      </>
                    )}
                    {isLocked && (
                      <Button size="sm" className="gap-1.5 text-white"
                        style={isBanned ? { backgroundColor: '#16a34a' } : { backgroundColor: '#d97706' }}
                        onClick={() => { setConfirmAction(isBanned ? 'unban' : 'unsuspend'); setConfirmOpen(true) }}>
                        <PlayCircle className="h-4 w-4" /> {isBanned ? 'Unban' : 'Lift Suspension'}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Quick contact */}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {user.mobileNumber}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {[user.district, user.state].filter(Boolean).join(', ') || '—'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined {formatDate(user.createdAt) ?? '—'}
                </span>
                {user.lastLoginAt && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Last seen {formatDateTime(user.lastLoginAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lock alert card */}
      {isLocked && (
        <Card className={cn(
          'border-2',
          isBanned ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30' : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'
        )}>
          <CardContent className="p-4 flex items-start gap-3">
            {isBanned
              ? <Ban className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              : <PauseCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />}
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                {isBanned ? 'Permanently Banned' : 'Account Suspended'}
              </p>
              {(user.suspendedReason ?? user.bannedReason) && (
                <p className="mt-1 text-sm italic text-muted-foreground">
                  "{user.suspendedReason ?? user.bannedReason}"
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  {isBanned ? 'Banned' : 'Suspended'} {formatDate(isBanned ? user.bannedAt : user.suspendedAt)}
                </span>
                {!isBanned && user.suspendedUntil && (
                  <span>Until {formatDate(user.suspendedUntil)}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats strip — only show when there are questions */}
      {questions.length > 0 && <StatsStrip questions={questions} />}

      {/* Account + Questions — stacked vertically */}
      <div className="flex flex-col gap-4">

        {/* Account details card */}
        <Card>
          <CardHeader className="p-0">
            <button
              className={cn(
                'flex items-center justify-center w-full cursor-pointer transition-all duration-200 py-3',
                !accountCollapsed && 'justify-between px-2',
              )}
              onClick={() => setAccountCollapsed((c) => !c)}
              aria-expanded={!accountCollapsed}
            >
              <div className={cn('flex items-center gap-2', accountCollapsed ? '' : '')}>
                {!accountCollapsed ? (
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                )}
                <CardTitle className="text-sm font-semibold">Account Details</CardTitle>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
                  accountCollapsed ? '-rotate-90' : '',
                )}
              />
            </button>
          </CardHeader>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              accountCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100',
            )}
          >
            <CardContent className="pt-4">
              <DetailRow label="Language" value={user.languagePreference || '—'} />
              <DetailRow label="Category" value={user.category ?? '—'} />
              <DetailRow label="State" value={user.state || '—'} />
              <DetailRow label="District" value={user.district || '—'} />
              <DetailRow label="Block" value={user.block ?? '—'} />
              <DetailRow label="Joined" value={formatDate(user.createdAt) ?? '—'} />
              <DetailRow label="Last Login" value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'} />
              <DetailRow label="Role" value={user.role.replace('_', ' ')} />
              <DetailRow label="Status" value={<VerificationBadge status={user.verificationStatus} />} />
            </CardContent>
          </div>
        </Card>

        {/* Payment Methods card */}
        <Card>
          <CardHeader className="p-0">
            <button
              className={cn(
                'flex items-center justify-between w-full cursor-pointer transition-all duration-200 py-3 px-6',
              )}
              onClick={() => setPaymentCollapsed((c) => !c)}
              aria-expanded={!paymentCollapsed}
            >
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-semibold">Payment Methods</CardTitle>
                {paymentDetails.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{paymentDetails.length}</Badge>
                )}
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
                  paymentCollapsed ? '-rotate-90' : '',
                )}
              />
            </button>
          </CardHeader>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              paymentCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100',
            )}
          >
            <CardContent className="pt-2">
              {paymentDetails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                  <CreditCard className="h-7 w-7 opacity-25" />
                  <p className="text-xs">No payment methods added</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentDetails.map((pd) => (
                    <div key={pd.id} className="flex items-start justify-between py-3 border-b border-border/60 last:border-0 gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-foreground">
                            {pd.payoutMethod === 'bank_transfer' ? (
                              <span className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5" />
                                {pd.bankName ?? 'Bank Account'}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                < Smartphone className="h-3.5 w-3.5" />
                                UPI
                              </span>
                            )}
                          </span>
                          <PaymentStatusBadge status={pd.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {pd.displayValue}
                          {pd.payoutMethod === 'bank_transfer' && pd.ifsc && (
                            <span className="ml-2">IFSC: {pd.ifsc}</span>
                          )}
                        </p>
                        {pd.accountHolderName && (
                          <p className="text-xs text-muted-foreground capitalize">
                            {pd.accountHolderName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Added {formatDate(pd.createdAt) ?? '—'}
                          {pd.verifiedAt && (
                            <span className="ml-2 text-emerald-600">
                              Verified {formatDate(pd.verifiedAt)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </div>
        </Card>

        {/* Questions card */}
        <Card>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-semibold">Questions</CardTitle>
                <Badge variant="secondary" className="text-xs">{questions.length}</Badge>
              </div>
              {questions.length > 0 && (
                <ViewToggle view={qView} onChange={(v) => { setQView(v); setQPage(1) }} />
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 border border-dashed border-border rounded-xl">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">No questions submitted yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Questions from this user will appear here</p>
                </div>
              </div>
            ) : qView === 'table' ? (
              <DataTable
                data={paginatedQuestions}
                columns={tableColumns}
                loading={false}
                page={qPage}
                totalPages={totalPages}
                totalCount={filteredQuestions.length}
                searchValue={qSearch}
                onSearchChange={setQSearch}
                onPageChange={setQPage}
                SkeletonRows={Q_PAGE_SIZE}
                emptyMessage="No questions match your filter"
              />
            ) : (
              <CardView
                data={paginatedQuestions}
                columns={cardColumns}
                loading={false}
                page={qPage}
                totalPages={totalPages}
                totalCount={filteredQuestions.length}
                onPageChange={setQPage}
                SkeletonRows={Q_CARD_PAGE_SIZE}
                emptyMessage="No questions match your filter"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit History — super_admin only */}
      {isSuperAdmin && (
        <Card>
          <CardHeader className="p-0">
            <button
              className="flex items-center justify-between w-full cursor-pointer transition-all duration-200 py-3 px-6"
              onClick={() => {
                if (auditCollapsed && auditEntries.length === 0) {
                  loadAuditHistory()
                } else {
                  setAuditCollapsed((c) => !c)
                }
              }}
              aria-expanded={!auditCollapsed}
            >
              <div className="flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-semibold">Audit History</CardTitle>
                {auditEntries.length > 0 && (
                  <Badge variant="secondary" className="text-xs">{auditEntries.length}</Badge>
                )}
                {auditLoading && (
                  <span className="ml-1 h-3 w-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <ChevronRight
                className={cn(
                  'h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200',
                  auditCollapsed ? '' : 'rotate-90',
                )}
              />
            </button>
          </CardHeader>
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              auditCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100',
            )}
          >
            <CardContent className="pt-0">
              {/* Loading skeleton */}
              {auditLoading ? (
                <div className="space-y-2 py-2">
                  {[3, 2, 4].map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : auditEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                  <ScrollText className="h-7 w-7 opacity-25" />
                  <p className="text-xs">No audit history for this user</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {auditEntries
                      .slice((auditPage - 1) * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE)
                      .map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 rounded-lg border border-border-subtle px-3 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors"
                        >
                          {/* Avatar initials */}
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0">
                            {(entry.actorName ?? entry.actorId ?? 'S').charAt(0).toUpperCase()}
                          </div>
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-foreground">
                                {entry.actorName
                                  ? `${entry.actorName} (${entry.actorRole ?? entry.actorType})`
                                  : entry.actorId ?? 'System'}
                              </span>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {entry.action.replace(/_/g, ' ').toLowerCase()}
                              </Badge>
                            </div>
                            {entry.oldValue && entry.newValue && (
                              <p className="mt-1 text-xs text-muted-foreground font-mono">
                                {JSON.stringify(entry.oldValue)} → {JSON.stringify(entry.newValue)}
                              </p>
                            )}
                          </div>
                          {/* Timestamp */}
                          <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap mt-0.5">
                            {formatDateTime(entry.createdAt) ?? entry.createdAt}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Pagination */}
                  {auditEntries.length > AUDIT_PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-subtle">
                      <span className="text-xs text-muted-foreground">
                        {(auditPage - 1) * AUDIT_PAGE_SIZE + 1}–{Math.min(auditPage * AUDIT_PAGE_SIZE, auditEntries.length)} of {auditEntries.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                          disabled={auditPage === 1}
                          className="h-7 w-7 flex items-center justify-center rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-xs text-muted-foreground px-1">{auditPage}</span>
                        <button
                          onClick={() => setAuditPage((p) => p + 1)}
                          disabled={auditPage * AUDIT_PAGE_SIZE >= auditEntries.length}
                          className="h-7 w-7 flex items-center justify-center rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </div>
        </Card>
      )}

      {/* Suspend / Ban dialog */}
      <Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{suspendAction === 'ban' ? 'Ban User' : 'Suspend User'}</DialogTitle>
            <DialogDescription>
              {suspendAction === 'ban'
                ? 'This will permanently prevent the user from accessing the platform.'
                : 'The user will be locked out until the suspension end date.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Input
                id="reason"
                placeholder="Enter reason for this action..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
            {suspendAction === 'suspend' && (
              <div className="space-y-2">
                <Label htmlFor="until">Suspend Until</Label>
                <Input
                  id="until"
                  type="date"
                  value={suspendUntil}
                  onChange={(e) => setSuspendUntil(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendModalOpen(false)}>Cancel</Button>
            <Button
              style={suspendModalOpen === false ? {} : suspendAction === 'ban' ? { backgroundColor: '#dc2626' } : { backgroundColor: '#d97706' }}
              onClick={handleSuspendBan}
              disabled={actionLoading || !suspendReason.trim()}
            >
              {actionLoading ? 'Processing...' : suspendAction === 'ban' ? 'Ban User' : 'Suspend User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm reinstate dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction === 'unban' ? 'Unban User?' : 'Lift Suspension?'}</DialogTitle>
            <DialogDescription>
              This will restore {user.name || user.mobileNumber}&apos;s access to the platform.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleReinstate} disabled={actionLoading}>
              {actionLoading ? 'Processing...' : confirmAction === 'unban' ? 'Unban User' : 'Lift Suspension'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}