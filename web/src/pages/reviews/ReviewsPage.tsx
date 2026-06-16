import { useState, useEffect } from 'react'
import { curatorApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  ChevronLeft, ChevronRight,
  Clock, User, Star, IndianRupee,
  MapPin, Wheat, CloudRain, Globe, Film,
  Eye, Hash, AlertTriangle,
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

export function ReviewsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const limit = 20

  // Reject dialog
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectQuestionId, setRejectQuestionId] = useState<string | null>(null)

  // Hold dialog
  const [holdOpen, setHoldOpen] = useState(false)
  const [holdReason, setHoldReason] = useState('')
  const [holdQuestionId, setHoldQuestionId] = useState<string | null>(null)

  // Question detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null)

  // Approve dialog (shows reward info)
  const [approveOpen, setApproveOpen] = useState(false)
  const [approveQuestionId, setApproveQuestionId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    curatorApi.getReviewQueue({ page, limit, status: statusFilter || undefined })
      .then((res) => { setQuestions(res.items as Question[]); setTotal(res.total) })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load review queue')))
      .finally(() => setLoading(false))
  }, [page, statusFilter])

  async function handleApprove(id: string) {
    setApproveQuestionId(id)
    setApproveOpen(true)
  }

  async function confirmApprove() {
    if (!approveQuestionId) return
    setActionLoading(approveQuestionId)
    try {
      const result = await curatorApi.reviewQuestion(approveQuestionId, { action: 'approve' })
      toast.success(
        result?.rewardCredited != null
          ? `Question approved — ₹${result.rewardCredited} credited to farmer`
          : 'Question approved',
      )
      setApproveOpen(false)
      setApproveQuestionId(null)
      setQuestions((qs) => qs.filter((q) => q.id !== approveQuestionId))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to approve'))
    } finally {
      setActionLoading(null)
    }
  }

  function openRejectDialog(id: string) {
    setRejectQuestionId(id)
    setRejectReason('')
    setRejectOpen(true)
  }

  async function confirmReject() {
    if (!rejectQuestionId) return
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }
    setActionLoading(rejectQuestionId)
    try {
      await curatorApi.reviewQuestion(rejectQuestionId, { action: 'reject', reason: rejectReason.trim() })
      toast.success('Question rejected')
      setRejectOpen(false)
      setRejectQuestionId(null)
      setRejectReason('')
      setQuestions((qs) => qs.filter((q) => q.id !== rejectQuestionId))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to reject'))
    } finally {
      setActionLoading(null)
    }
  }

  function openHoldDialog(id: string) {
    setHoldQuestionId(id)
    setHoldReason('')
    setHoldOpen(true)
  }

  async function confirmHold() {
    if (!holdQuestionId) return
    if (!holdReason.trim()) {
      toast.error('Please provide a reason for holding this question')
      return
    }
    setActionLoading(holdQuestionId)
    try {
      await curatorApi.reviewQuestion(holdQuestionId, { action: 'hold', heldReason: holdReason.trim() })
      toast.success('Question put on hold')
      setHoldOpen(false)
      setHoldQuestionId(null)
      setHoldReason('')
      setQuestions((qs) => qs.filter((q) => q.id !== holdQuestionId))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to hold question'))
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

  const isActionDisabled = (id: string) => actionLoading === id

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Review Queue</h2>
          <p className="text-sm text-muted-foreground">{total} questions awaiting review</p>
        </div>
        {total > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">{total} pending</Badge>
        )}
      </div>

      {/* Filters info bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-warning" /> Pending
            </span>
            <span className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[hsl(263,70%,50%)]" /> AI Review
            </span>
            <span className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[hsl(330,81%,60%)]" /> Human Review
            </span>
            <span className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[hsl(38,92%,50%)]" /> Held
            </span>
          </div>
          <select
            className="ml-auto h-9 rounded-md border border-input bg-surface-variant px-3 text-sm text-text"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Queues</option>
            <option value="pending">Pending</option>
            <option value="ai_review">AI Review</option>
            <option value="human_review">Human Review</option>
            <option value="held">Held</option>
          </select>
        </div>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <div className="h-5 w-3/4 rounded bg-muted animate-pulse mb-3" />
              <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
            </Card>
          ))
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="rounded-full bg-success/10 p-4">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No questions awaiting review right now.</p>
            </div>
          </div>
        ) : (
          questions.map((q) => (
            <Card
              key={q.id}
              className="overflow-hidden hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => { setDetailQuestion(q); setDetailOpen(true) }}
            >
            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  {/* Badges row */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge className={cn('capitalize', STATUS_COLORS[q.status] ?? 'bg-muted')}>
                      {q.status.replace('_', ' ')}
                    </Badge>
                    {q.domainCategory && (
                      <span className="text-xs font-medium text-muted-foreground">{q.domainCategory}</span>
                    )}
                    {q.cropType && (
                      <span className="text-xs text-muted-foreground">{q.cropType}</span>
                    )}
                    {q.aiConfidenceScore != null && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3" /> {q.aiConfidenceScore}%
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                      <Clock className="h-3 w-3" /> {formatDate(q.submittedAt)}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-foreground leading-relaxed">{q.questionText}</p>

                  {/* Media */}
                  {q.mediaUrls && q.mediaUrls.length > 0 && (
                    <div className="mt-3 rounded-md overflow-hidden border flex gap-1">
                      {q.mediaUrls.slice(0, 3).map((url, i) => (
                        <img key={i} src={url} alt="media" className="h-20 object-cover flex-1" />
                      ))}
                    </div>
                  )}

                  {/* Location */}
                  {(q.state || q.district) && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      {[q.district, q.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>

                {/* Action buttons — only for reviewable questions */}
                {REVIEWABLE_STATUSES.includes(q.status) && (
                  <div className="flex flex-col gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      className="bg-success hover:bg-success/90"
                      onClick={() => handleApprove(q.id)}
                      disabled={isActionDisabled(q.id)}
                      title="Approve"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[hsl(38,92%,50%)] text-[hsl(38,92%,50%)] hover:bg-[hsl(38,92%,50%)]/10"
                      onClick={() => openHoldDialog(q.id)}
                      disabled={isActionDisabled(q.id)}
                      title="Hold for later"
                    >
                      <PauseCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openRejectDialog(q.id)}
                      disabled={isActionDisabled(q.id)}
                      title="Reject"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
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
            <DialogTitle>Approve Question</DialogTitle>
            <DialogDescription>
              This will approve the question and credit reward to the farmer.
              Are you sure you want to approve?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-success/10 border border-success/20 rounded-md p-3 flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-success shrink-0" />
            <p className="text-sm text-success">
              Reward will be automatically credited to the farmer's wallet upon approval.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
            <Button className="bg-success hover:bg-success/90" onClick={confirmApprove} disabled={!!actionLoading}>
              <CheckCircle className="h-4 w-4 mr-1" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reject Dialog ─── */}
      <Dialog open={rejectOpen} onOpenChange={(o) => { if (!o) { setRejectOpen(false); setRejectQuestionId(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Question</DialogTitle>
            <DialogDescription>
              Please provide a clear reason for rejection. This will be visible to the farmer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Rejection Reason <span className="text-destructive">*</span></Label>
            <Input
              id="reject-reason"
              placeholder="e.g., Off-topic, duplicate question, insufficient detail..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmReject()}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!!actionLoading}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Question Detail Dialog ─── */}
      <Dialog open={detailOpen} onOpenChange={(o) => { if (!o) { setDetailOpen(false); setDetailQuestion(null) } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
              {/* Status & badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn('capitalize', STATUS_COLORS[detailQuestion.status] ?? 'bg-muted')}>
                  {detailQuestion.status.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground capitalize">{detailQuestion.domainCategory}</span>
                {detailQuestion.aiConfidenceScore != null && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3" /> AI confidence: {detailQuestion.aiConfidenceScore}%
                  </span>
                )}
                {detailQuestion.duplicateFlag && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Duplicate
                  </Badge>
                )}
              </div>

              {/* Question text */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {detailQuestion.questionText}
                </p>
              </div>

              {/* Metadata grid */}
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
                  <div className="col-span-2 mt-1">
                    <InfoRow icon={XCircle} label="Rejection Reason" value={detailQuestion.rejectionReason} />
                  </div>
                )}
                {detailQuestion.heldReason && (
                  <div className="col-span-2 mt-1">
                    <InfoRow icon={PauseCircle} label="Hold Reason" value={detailQuestion.heldReason} />
                  </div>
                )}
              </div>

              {/* Media */}
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDetailOpen(false); setDetailQuestion(null) }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Hold Dialog ─── */}
      <Dialog open={holdOpen} onOpenChange={(o) => { if (!o) { setHoldOpen(false); setHoldQuestionId(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold Question</DialogTitle>
            <DialogDescription>
              Put this question on hold if it needs further review, additional context,
              or is waiting for something before a final decision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="hold-reason">Hold Reason <span className="text-destructive">*</span></Label>
            <Input
              id="hold-reason"
              placeholder="e.g., Waiting for AI model update, needs expert input..."
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmHold()}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setHoldOpen(false)}>Cancel</Button>
            <Button
              className="bg-[hsl(38,92%,50%)] hover:bg-[hsl(38,92%,45%)] text-white"
              onClick={confirmHold}
              disabled={!!actionLoading}
            >
              <PauseCircle className="h-4 w-4 mr-1" /> Hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}