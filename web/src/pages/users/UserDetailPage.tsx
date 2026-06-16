import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatDate, formatDateTime, getInitials } from '@/lib/utils'
import {
  ArrowLeft, Ban, PauseCircle, PlayCircle, CheckCircle,
  ShieldCheck, MapPin, Phone, Calendar, MessageSquare,
  Clock, FileText, Image, BarChart2, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import type { User, Question, QuestionStatus } from '@/types'

// ─── Status badge helpers ──────────────────────────────────────────────────────

function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    verified:      { label: 'Verified',      cls: 'bg-success text-white' },
    pending:       { label: 'Pending Review', cls: 'bg-warning text-white' },
    manual_review: { label: 'Manual Review', cls: 'bg-chart2 text-white' },
    suspended:     { label: 'Suspended',     cls: 'bg-warning text-white' },
    banned:        { label: 'Banned',        cls: 'bg-destructive text-white' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-muted' }
  return <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', cls)}>{label}</span>
}

function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  const map: Record<QuestionStatus, { label: string; dot: string; cls: string }> = {
    pending:      { label: 'Pending',      dot: 'bg-warning',  cls: 'border-warning/40 text-warning' },
    ai_review:    { label: 'AI Review',    dot: 'bg-chart2',   cls: 'border-chart2/40 text-chart2' },
    human_review: { label: 'Human Review', dot: 'bg-primary',  cls: 'border-primary/40 text-primary' },
    held:         { label: 'Held',          dot: 'bg-[hsl(38,92%,50%)]', cls: 'border-[hsl(38,92%,50%)]/40 text-[hsl(38,92%,50%)]' },
    approved:     { label: 'Approved',     dot: 'bg-success',  cls: 'border-success/40 text-success' },
    rejected:     { label: 'Rejected',     dot: 'bg-destructive', cls: 'border-destructive/40 text-destructive' },
  }
  const { label, dot } = map[status] ?? { label: status, dot: 'bg-muted' }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {label}
    </span>
  )
}

// ─── Question card ─────────────────────────────────────────────────────────────

function QuestionCard({ q }: { q: Question }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border bg-card">
      <button
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className={cn('mt-2 h-2 w-2 shrink-0 rounded-full',
          q.status === 'approved' ? 'bg-success' :
          q.status === 'rejected'  ? 'bg-destructive' :
          'bg-warning'
        )} />
        <div className="min-w-0 flex-1">
          <p className={cn(
            'text-sm text-foreground leading-relaxed',
            !expanded && 'line-clamp-2'
          )}>{q.questionText}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <QuestionStatusBadge status={q.status} />
            {q.domainCategory && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {q.domainCategory}
              </span>
            )}
            {q.cropType && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {q.cropType}
              </span>
            )}
            {q.aiConfidenceScore != null && (
              <span className="text-xs text-muted-foreground">
                AI {Math.round(q.aiConfidenceScore * 100)}%
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {formatDate(q.submittedAt) ?? '—'}
            </span>
          </div>
        </div>
        <ChevronRight className={cn('h-4 w-4 shrink-0 mt-1 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[
              ['Language', q.language],
              ['State', q.state],
              ['District', q.district],
              ['Block', q.block ?? '—'],
              ['Media', q.mediaType || '—'],
              ['Duplicate flag', q.duplicateFlag ? 'Yes' : 'No'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <span className="text-muted-foreground text-xs">{k}</span>
                <span className="text-foreground text-xs font-medium capitalize">{v}</span>
              </div>
            ))}
          </div>
          {q.mediaUrls && q.mediaUrls.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {q.mediaUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Image className="h-3.5 w-3.5" /> Attachment {i + 1}
                </a>
              ))}
            </div>
          )}
          {q.rejectionReason && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
              <p className="text-xs text-destructive font-medium mb-0.5">Rejection reason</p>
              <p className="text-xs text-muted-foreground">{q.rejectionReason}</p>
            </div>
          )}
        </div>
      )}
    </div>
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

  return (
    <div className="grid grid-cols-4 gap-3">
      {[
        { label: 'Total', value: counts.total, bg: 'bg-primary/10', iconCls: 'text-primary' },
        { label: 'Approved', value: counts.approved, bg: 'bg-success/10', iconCls: 'text-success' },
        { label: 'Pending', value: counts.pending, bg: 'bg-warning/10', iconCls: 'text-warning' },
        { label: 'Rejected', value: counts.rejected, bg: 'bg-destructive/10', iconCls: 'text-destructive' },
      ].map(({ label, value, bg, iconCls }) => (
        <div key={label} className={cn('flex items-center justify-between rounded-lg border p-3', bg)}>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-2xl font-extrabold text-foreground">{value}</p>
          </div>
          <BarChart2 className={cn('h-5 w-5 opacity-60', iconCls)} />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [user, setUser] = useState<User | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [suspendModalOpen, setSuspendModalOpen] = useState(false)
  const [suspendAction, setSuspendAction] = useState<'suspend' | 'ban'>('suspend')
  const [suspendReason, setSuspendReason] = useState('')
  const [suspendUntil, setSuspendUntil] = useState('')

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'unsuspend' | 'unban'>('unsuspend')

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    adminApi.getUserDetail(userId)
      .then((res) => { setUser(res.user as User); setQuestions(res.questions as Question[]) })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load user')))
      .finally(() => setLoading(false))
  }, [userId])

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
      setUser(r.user as User)
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
      setUser(r.user as User)
    } catch (e) {
      toast.error(getErrorMessage(e, `Failed to ${suspendAction}`))
    } finally {
      setActionLoading(false)
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
      setUser(r.user as User)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to reinstate'))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
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
  const avatarBg = isBanned ? 'bg-destructive' : isSuspended ? 'bg-warning' : 'bg-primary'

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
      <Card>
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
                      <Button size="sm" className="bg-success hover:bg-success/90 gap-1.5" onClick={handleVerify} disabled={actionLoading}>
                        <CheckCircle className="h-4 w-4" /> Verify
                      </Button>
                    )}
                    {!isLocked && (
                      <>
                        <Button size="sm" variant="outline" className="gap-1.5 text-warning border-warning/50 hover:bg-warning/10"
                          onClick={() => { setSuspendAction('suspend'); setSuspendModalOpen(true) }}>
                          <PauseCircle className="h-4 w-4" /> Suspend
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/50 hover:bg-destructive/10"
                          onClick={() => { setSuspendAction('ban'); setSuspendModalOpen(true) }}>
                          <Ban className="h-4 w-4" /> Ban
                        </Button>
                      </>
                    )}
                    {isLocked && (
                      <Button size="sm" className="gap-1.5"
                        style={isBanned ? { backgroundColor: 'hsl(var(--destructive))' } : { backgroundColor: 'hsl(33,93%,54%)' }}
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

      {/* Lock alert */}
      {isLocked && (
        <Card className={cn(
          'border-2',
          isBanned ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5'
        )}>
          <CardContent className="p-4 flex items-start gap-3">
            {isBanned
              ? <Ban className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              : <PauseCircle className="h-5 w-5 text-warning mt-0.5 shrink-0" />}
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

      {/* Question stats strip */}
      {questions.length > 0 && <StatsStrip questions={questions} />}

      {/* Account + Questions */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Account details */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {[
              { label: 'Language', value: user.languagePreference || '—' },
              { label: 'Category', value: user.category ?? '—' },
              { label: 'State', value: user.state || '—' },
              { label: 'District', value: user.district || '—' },
              { label: 'Block', value: user.block ?? '—' },
              { label: 'Joined', value: formatDate(user.createdAt) ?? '—' },
              { label: 'Last Login', value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                <span className="text-muted-foreground text-xs">{label}</span>
                <span className="font-medium text-foreground text-xs capitalize text-right max-w-[160px] truncate">
                  {String(value).replace('_', ' ')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Questions */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Questions
              <Badge variant="secondary" className="ml-1 text-xs">{questions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No questions submitted yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {questions.map((q) => <QuestionCard key={q.id} q={q} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
              style={suspendAction === 'ban' ? { backgroundColor: 'hsl(var(--destructive))' } : { backgroundColor: 'hsl(33,93%,54%)' }}
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