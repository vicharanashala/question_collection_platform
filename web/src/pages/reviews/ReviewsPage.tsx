import { useState, useEffect } from 'react'
import { curatorApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatDate } from '@/lib/utils'
import {
  CheckCircle, XCircle, PauseCircle,
  ChevronLeft, ChevronRight, Search,
  Clock, User, Star, IndianRupee,
  MapPin, Wheat, CloudRain, Globe, Film,
  Eye, Hash, AlertTriangle, ChevronDown,
  MessageSquare, InboxIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning text-white',
  ai_review: 'bg-ai_review text-white',
  human_review: 'bg-human_review text-white',
  held: 'bg-[hsl(38,92%,50%)] text-white',
  approved: 'bg-success text-white',
  rejected: 'bg-destructive text-white',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  ai_review: 'AI Review',
  human_review: 'Human Review',
  held: 'Held',
}

const REVIEWABLE_STATUSES = ['pending', 'ai_review', 'human_review', 'held']

const SEASON_LABEL: Record<string, string> = {
  kharif: 'Kharif',
  rabi: 'Rabi',
  zaid: 'Zaid',
  year_round: 'Year Round',
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground min-w-[110px]">{label}</span>
      <span className="text-sm text-foreground font-medium">{value}</span>
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  className,
  onClick,
  disabled,
  title,
}: {
  icon: React.ElementType
  label: string
  className: string
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={disabled}
      title={title ?? label}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  )
}

function ReviewCard({ q, onOpen, onApprove, onHold, onReject, actionLoading }: {
  q: Question
  onOpen: (q: Question) => void
  onApprove: (id: string) => void
  onHold: (id: string) => void
  onReject: (id: string) => void
  actionLoading: string | null
}) {
  const disabled = actionLoading === q.id
  return (
    <Card
      className="group overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer"
      onClick={() => onOpen(q)}
    >
      <CardContent className="p-0">
        {/* Top: status + domain + meta + user */}
        <div className="flex items-start justify-between gap-3 p-4 pb-0">
          <div className="flex flex-col gap-1.5 min-w-0">
            {/* User identity */}
            <span className="text-xs font-semibold text-foreground truncate">
              {q.user?.name ?? q.userName ?? q.user?.mobileNumber ?? q.userMobileNumber ?? 'Unknown'}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('capitalize text-xs px-2 py-0.5', STATUS_COLORS[q.status] ?? 'bg-muted')}>
                {STATUS_LABELS[q.status] ?? q.status}
              </Badge>
              {q.aiConfidenceScore != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 text-warning" />
                  <span className="font-medium">{q.aiConfidenceScore}%</span>
                </span>
              )}
              {q.domainCategory && (
                <span className="text-xs font-medium text-info bg-info/10 px-2 py-0.5 rounded-full capitalize">
                  {q.domainCategory}
                </span>
              )}
              {q.cropType && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Wheat className="h-3 w-3" /> {q.cropType}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {formatDate(q.submittedAt)}
            </span>
          </div>
        </div>

        {/* Question text */}
        <div className="px-4 pt-3">
          <p className="text-sm font-medium text-foreground leading-relaxed line-clamp-2">
            {q.questionText}
          </p>
        </div>

        {/* Media thumbnails */}
        {q.mediaUrls && q.mediaUrls.length > 0 && (
          <div className="px-4 pt-3 flex gap-1.5">
            {q.mediaUrls.slice(0, 4).map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`media-${i}`}
                className="h-16 w-16 object-cover rounded-md border bg-muted"
              />
            ))}
            {q.mediaUrls.length > 4 && (
              <div className="h-16 w-16 rounded-md border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                +{q.mediaUrls.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Bottom: location + actions */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {q.state && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {q.state}{q.district ? `, ${q.district}` : ''}
              </span>
            )}
          </div>
          <Eye className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Action bar — stops propagation so card click opens detail, not actions */}
        {REVIEWABLE_STATUSES.includes(q.status) && (
          <div
            className="border-t border-border-subtle bg-muted/30 px-4 py-3 flex flex-wrap items-center gap-2 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <ActionButton
              icon={CheckCircle}
              label="Approve"
              className="bg-success/10 text-success hover:bg-success/20 border border-success/20"
              onClick={() => onApprove(q.id)}
              disabled={disabled}
            />
            <ActionButton
              icon={PauseCircle}
              label="Hold"
              className="bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20"
              onClick={() => onHold(q.id)}
              disabled={disabled}
            />
            <ActionButton
              icon={XCircle}
              label="Reject"
              className="bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
              onClick={() => onReject(q.id)}
              disabled={disabled}
            />
            <button
              onClick={(e) => { e.stopPropagation(); onOpen(q) }}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-1.5"
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ReviewsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const limit = 20

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectQuestionId, setRejectQuestionId] = useState<string | null>(null)

  const [holdOpen, setHoldOpen] = useState(false)
  const [holdReason, setHoldReason] = useState('')
  const [holdQuestionId, setHoldQuestionId] = useState<string | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null)

  const [approveQuestionId, setApproveQuestionId] = useState<string | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [approveReason, setApproveReason] = useState('')

  useEffect(() => {
    setLoading(true)
    curatorApi.getReviewQueue({ page, limit, status: statusFilter || undefined })
      .then((res) => { setQuestions(res.items as Question[]); setTotal(res.total) })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load review queue')))
      .finally(() => setLoading(false))
  }, [page, statusFilter])

  async function confirmApprove() {
    if (!approveQuestionId) return
    if (!approveReason.trim()) { toast.error('Approval reason is required'); return }
    setActionLoading(approveQuestionId)
    try {
      const result = await curatorApi.reviewQuestion(approveQuestionId, { action: 'approve', reason: approveReason.trim() })
      toast.success(
        result?.rewardCredited != null
          ? `Approved — ₹${result.rewardCredited} credited to farmer`
          : 'Question approved',
      )
      setApproveOpen(false)
      setApproveQuestionId(null)
      setApproveReason('')
      setQuestions((qs) => qs.filter((q) => q.id !== approveQuestionId))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to approve'))
    } finally {
      setActionLoading(null)
    }
  }

  async function confirmReject() {
    if (!rejectQuestionId) return
    if (!rejectReason.trim()) { toast.error('Rejection reason is required'); return }
    setActionLoading(rejectQuestionId)
    try {
      await curatorApi.reviewQuestion(rejectQuestionId, { action: 'reject', reason: rejectReason.trim() })
      toast.success('Question rejected')
      setRejectOpen(false); setRejectQuestionId(null); setRejectReason('')
      setQuestions((qs) => qs.filter((q) => q.id !== rejectQuestionId))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to reject'))
    } finally {
      setActionLoading(null)
    }
  }

  async function confirmHold() {
    if (!holdQuestionId) return
    if (!holdReason.trim()) { toast.error('Hold reason is required'); return }
    setActionLoading(holdQuestionId)
    try {
      await curatorApi.reviewQuestion(holdQuestionId, { action: 'hold', heldReason: holdReason.trim() })
      toast.success('Question put on hold')
      setHoldOpen(false); setHoldQuestionId(null); setHoldReason('')
      setQuestions((qs) => qs.filter((q) => q.id !== holdQuestionId))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to hold question'))
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

  const isEmpty = !loading && questions.length === 0

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Review Queue</h2>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} question${total === 1 ? '' : 's'} awaiting review` : 'No questions pending'}
          </p>
        </div>
        {total > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">{total}</Badge>
        )}
      </div>

      {/* Status legend + filter */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4">
          {/* Status dots legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', STATUS_COLORS[key])} />
                {label}
              </span>
            ))}
          </div>
          {/* Status filter */}
          <div className="relative sm:ml-auto">
            <select
              className="h-9 rounded-md border border-border-subtle bg-surface px-3 pl-3 pr-8 text-sm text-text appearance-none cursor-pointer"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            >
              <option value="">All Queues</option>
              <option value="pending">Pending</option>
              <option value="ai_review">AI Review</option>
              <option value="human_review">Human Review</option>
              <option value="held">Held</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </Card>

      {/* Questions list */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-5 w-24 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                <div className="flex gap-1.5">
                  <div className="h-16 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-16 w-16 rounded bg-muted animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="rounded-full bg-success/10 p-5">
                <InboxIcon className="h-10 w-10 text-success" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">No questions awaiting review right now.</p>
              </div>
              {statusFilter && (
                <Button variant="outline" size="sm" onClick={() => setStatusFilter('')}>
                  Clear filter
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          questions.map((q) => (
            <ReviewCard
              key={q.id}
              q={q}
              onOpen={(qq) => { setDetailQuestion(qq); setDetailOpen(true) }}
              onApprove={(id) => { setApproveQuestionId(id); setApproveReason(''); setApproveOpen(true) }}
              onHold={(id) => { setHoldQuestionId(id); setHoldReason(''); setHoldOpen(true) }}
              onReject={(id) => { setRejectQuestionId(id); setRejectReason(''); setRejectOpen(true) }}
              actionLoading={actionLoading}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2 min-w-[80px] text-center">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Approve Dialog ─── */}
      <Dialog open={approveOpen} onOpenChange={(o) => { if (!o) { setApproveOpen(false); setApproveQuestionId(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" /> Approve Question
            </DialogTitle>
            <DialogDescription>
              This will approve the question and credit the reward to the farmer's wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-success/10 border border-success/20 rounded-lg p-3 flex items-center gap-2.5">
            <IndianRupee className="h-4 w-4 text-success shrink-0" />
            <p className="text-sm text-success font-medium">
              Reward will be credited to the farmer upon approval.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="approve-reason">Approval Reason <span className="text-destructive">*</span></Label>
            <Input
              id="approve-reason"
              placeholder="e.g., Clear, detailed, actionable question..."
              value={approveReason}
              onChange={(e) => setApproveReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmApprove()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button
              className="bg-success hover:bg-success/90"
              onClick={confirmApprove}
              disabled={!!actionLoading || !approveReason.trim()}
            >
              <CheckCircle className="h-4 w-4" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Dialog ─── */}
      <Dialog open={rejectOpen} onOpenChange={(o) => { if (!o) { setRejectOpen(false); setRejectQuestionId(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" /> Reject Question
            </DialogTitle>
            <DialogDescription>
              Provide a clear reason — this is visible to the farmer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Rejection Reason <span className="text-destructive">*</span></Label>
            <Input
              id="reject-reason"
              placeholder="e.g., Off-topic, duplicate, insufficient detail..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmReject()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!!actionLoading}>
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Hold Dialog ─── */}
      <Dialog open={holdOpen} onOpenChange={(o) => { if (!o) { setHoldOpen(false); setHoldQuestionId(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PauseCircle className="h-4 w-4 text-warning" /> Hold Question
            </DialogTitle>
            <DialogDescription>
              Put on hold if you need more context, expert input, or a later decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="hold-reason">Hold Reason <span className="text-destructive">*</span></Label>
            <Input
              id="hold-reason"
              placeholder="e.g., Awaiting expert review, needs AI model update..."
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmHold()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setHoldOpen(false)}>Cancel</Button>
            <Button className="bg-warning hover:bg-warning/90 text-white" onClick={confirmHold} disabled={!!actionLoading}>
              <PauseCircle className="h-4 w-4" /> Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Question Detail Dialog ─── */}
      <Dialog open={detailOpen} onOpenChange={(o) => { if (!o) { setDetailOpen(false); setDetailQuestion(null) } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Question Details
            </DialogTitle>
            <DialogDescription>
              Full information for the selected question.
            </DialogDescription>
          </DialogHeader>

          {detailQuestion && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn('capitalize text-xs px-2 py-0.5', STATUS_COLORS[detailQuestion.status] ?? 'bg-muted')}>
                  {STATUS_LABELS[detailQuestion.status] ?? detailQuestion.status}
                </Badge>
                <span className="text-xs text-muted-foreground capitalize">{detailQuestion.domainCategory}</span>
                {detailQuestion.aiConfidenceScore != null && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 text-warning" /> AI confidence: {detailQuestion.aiConfidenceScore}%
                  </span>
                )}
                {detailQuestion.duplicateFlag && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Duplicate
                  </Badge>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {detailQuestion.questionText}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <InfoRow icon={Hash} label="Question ID" value={<span className="font-mono text-xs">{detailQuestion.id.slice(0, 8)}…</span>} />
                <InfoRow icon={Globe} label="Language" value={detailQuestion.language?.toUpperCase()} />
                <InfoRow icon={Wheat} label="Crop Type" value={detailQuestion.cropType} />
                <InfoRow icon={CloudRain} label="Season" value={SEASON_LABEL[detailQuestion.season] ?? detailQuestion.season} />
                <InfoRow icon={MapPin} label="State" value={detailQuestion.state} />
                <InfoRow icon={MapPin} label="District" value={detailQuestion.district} />
                {detailQuestion.block && <InfoRow icon={MapPin} label="Block" value={detailQuestion.block} />}
                <InfoRow icon={User} label="Submitted" value={formatDate(detailQuestion.submittedAt)} />
                {detailQuestion.reviewedAt && <InfoRow icon={Clock} label="Reviewed" value={formatDate(detailQuestion.reviewedAt)} />}
                {detailQuestion.rejectionReason && (
                  <div className="col-span-2">
                    <InfoRow icon={XCircle} label="Rejection Reason" value={detailQuestion.rejectionReason} />
                  </div>
                )}
                {detailQuestion.heldReason && (
                  <div className="col-span-2">
                    <InfoRow icon={PauseCircle} label="Hold Reason" value={detailQuestion.heldReason} />
                  </div>
                )}
              </div>

              {detailQuestion.mediaUrls && detailQuestion.mediaUrls.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-sm text-muted-foreground">
                    <Film className="h-4 w-4" />
                    Media ({detailQuestion.mediaUrls.length})
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {detailQuestion.mediaUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`media-${i}`}
                          className="rounded-md border w-full h-24 object-cover hover:opacity-80 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDetailOpen(false); setDetailQuestion(null) }}>
              Close
            </Button>
            {detailQuestion && REVIEWABLE_STATUSES.includes(detailQuestion.status) && (
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  className="bg-success hover:bg-success/90"
                  onClick={() => { setDetailOpen(false); setApproveQuestionId(detailQuestion.id); setApproveReason(''); setApproveOpen(true) }}
                >
                  <CheckCircle className="h-4 w-4" /> Approve
                </Button>
                <Button
                  className="bg-warning hover:bg-warning/90 text-white"
                  onClick={() => { setDetailOpen(false); setHoldQuestionId(detailQuestion.id); setHoldReason(''); setHoldOpen(true) }}
                >
                  <PauseCircle className="h-4 w-4" /> Hold
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { setDetailOpen(false); setRejectQuestionId(detailQuestion.id); setRejectReason(''); setRejectOpen(true) }}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}