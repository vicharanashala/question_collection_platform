import { useState, useEffect, useRef } from 'react'
import { curatorApi, getErrorMessage } from '@/api/client'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatDate } from '@/lib/utils'
import {
  CheckCircle, XCircle, PauseCircle,
  ChevronLeft, ChevronRight, Search,
  Clock, Star, IndianRupee,
  MapPin, Wheat, Film,
  Eye, Hash, InboxIcon, RotateCcw,
  User, MessageSquare, Zap, Filter,
  AlertCircle, ThumbsUp, Ban,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Question, QuestionStatus } from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:      'bg-warning text-white',
  ai_review:    'bg-blue-500 text-white',
  human_review: 'bg-purple-500 text-white',
  held:         'bg-amber-500 text-white',
  approved:     'bg-success text-white',
  rejected:     'bg-destructive text-white',
}

const STATUS_LABELS: Record<string, string> = {
  pending:      'Pending',
  ai_review:    'AI Review',
  human_review: 'Human Review',
  held:         'Held',
  approved:     'Approved',
  rejected:     'Rejected',
}

const REVIEWABLE_STATUSES: QuestionStatus[] = ['pending', 'ai_review', 'human_review', 'held']

// ─── Review Reason Modal ──────────────────────────────────────────────────────

type ReviewAction = 'approve' | 'reject' | 'hold'

interface ReviewModalProps {
  action: ReviewAction
  questionId: string
  questionText: string
  onConfirm: (id: string, action: ReviewAction, reason: string) => void
  onCancel: () => void
  loading: boolean
}

function ReviewModal({ action, questionId, questionText, onConfirm, onCancel, loading }: ReviewModalProps) {
  const [reason, setReason] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setReason('')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [action])

  const isApprove = action === 'approve'
  const isReject  = action === 'reject'
  const isHold    = action === 'hold'

  const placeholders: Record<ReviewAction, string> = {
    approve: 'Explain why this question is approved — e.g., clear crop context, actionable query, sufficient detail...',
    reject:  'Explain why this question is rejected — e.g., off-topic, duplicate, insufficient detail, inappropriate...',
    hold:    'Explain why this question needs more review — e.g., needs expert input, unclear crop context...',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl border border-border-subtle overflow-hidden">
        {/* Header */}
        <div className={cn(
          'flex items-center gap-3 px-6 py-4',
          isApprove && 'bg-success/10',
          isReject  && 'bg-destructive/10',
          isHold    && 'bg-warning/10',
        )}>
          <div className={cn(
            'rounded-full p-2.5',
            isApprove ? 'bg-success/20 text-success' :
            isReject  ? 'bg-destructive/20 text-destructive' :
                        'bg-warning/20 text-warning',
          )}>
            {isApprove ? <ThumbsUp className="h-5 w-5" /> :
             isReject  ? <Ban className="h-5 w-5" /> :
                         <PauseCircle className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {isApprove ? 'Approve' : isReject ? 'Reject' : 'Hold'} Question
            </h3>
            <p className="text-xs text-muted-foreground">
              {isReject ? 'This reason will be shared with the farmer.' : 'This reason is recorded for audit.'}
            </p>
          </div>
        </div>

        {/* Question preview */}
        <div className="px-6 py-3 border-b border-border-subtle bg-muted/30">
          <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Question</p>
          <p className="text-sm text-foreground leading-relaxed line-clamp-3">{questionText}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Review Reason <span className="text-destructive">*</span>
            </Label>
            <textarea
              ref={textareaRef}
              rows={4}
              placeholder={placeholders[action]}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Be specific — a clear reason helps other curators and farmers understand the decision.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-muted/20">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            className={cn(
              isApprove && 'bg-success hover:bg-success/90 text-white',
              isReject  && 'bg-destructive hover:bg-destructive/90 text-white',
              isHold    && 'bg-warning hover:bg-warning/90 text-white',
            )}
            onClick={() => reason.trim() && onConfirm(questionId, action, reason.trim())}
            disabled={loading || !reason.trim()}
          >
            {loading ? 'Processing...' : `Confirm ${action.charAt(0).toUpperCase() + action.slice(1)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── AI Confidence Score Card ────────────────────────────────────────────────

function ConfidenceCard({ score }: { score: number }) {
  const color = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'destructive'
  const colorClass = color === 'success' ? 'text-success' : color === 'warning' ? 'text-warning' : 'text-destructive'
  const bgClass   = color === 'success' ? 'border-success/30 bg-success/5' :
                    color === 'warning' ? 'border-warning/30 bg-warning/5' :
                                         'border-destructive/30 bg-destructive/5'
  const barClass  = color === 'success' ? 'bg-success' :
                    color === 'warning' ? 'bg-warning' :
                                         'bg-destructive'

  return (
    <div className={cn('rounded-xl border p-4', bgClass)}>
      <div className="flex items-end gap-2">
        <span className={cn('text-4xl font-extrabold tabular-nums', colorClass)}>{score}%</span>
        <span className="text-sm text-muted-foreground mb-1.5">AI confidence</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', barClass)} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

// ─── Question list card ───────────────────────────────────────────────────────

function QuestionCard({
  q,
  selected,
  onSelect,
}: {
  q: Question
  selected: boolean
  onSelect: (q: Question) => void
}) {
  return (
    <div
      className={cn(
        'group relative rounded-xl border cursor-pointer transition-all duration-150',
        selected
          ? 'border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary/20'
          : 'border-border-subtle bg-surface hover:border-primary/30 hover:shadow-sm',
      )}
      onClick={() => onSelect(q)}
    >
      {/* Left accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-1 rounded-l-xl', STATUS_COLORS[q.status] ?? 'bg-muted')} />

      <div className="pl-4 pr-4 pt-4 pb-3">
        {/* Top row: status badge + meta */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={cn('capitalize text-xs px-2 py-0.5', STATUS_COLORS[q.status] ?? 'bg-muted')}>
              {STATUS_LABELS[q.status] ?? q.status}
            </Badge>
            {q.aiConfidenceScore != null && (
              <span className={cn(
                'flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full',
                q.aiConfidenceScore >= 80 ? 'bg-success/10 text-success' :
                q.aiConfidenceScore >= 50 ? 'bg-warning/10 text-warning' :
                'bg-destructive/10 text-destructive',
              )}>
                <Star className="h-3 w-3" />
                {q.aiConfidenceScore}%
              </span>
            )}
            {q.domainCategory && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950 px-2 py-0.5 rounded-full capitalize">
                {q.domainCategory}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{formatDate(q.submittedAt)}</span>
        </div>

        {/* Question text */}
        <p className="text-sm text-foreground leading-relaxed line-clamp-2 mb-2">
          {q.questionText}
        </p>

        {/* Footer meta */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          {q.cropType && (
            <span className="flex items-center gap-1"><Wheat className="h-3 w-3" /> {q.cropType}</span>
          )}
          {q.state && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {q.state}{q.district ? `, ${q.district}` : ''}</span>
          )}
          {q.mediaUrls && q.mediaUrls.length > 0 && (
            <span className="flex items-center gap-1"><Film className="h-3 w-3" /> {q.mediaUrls.length} media</span>
          )}
          {q.user?.name && (
            <span className="flex items-center gap-1"><User className="h-3 w-3" /> {q.user.name}</span>
          )}
        </div>

        {/* Held / rejection reason preview */}
        {q.status === 'held' && q.heldReason && (
          <div className="mt-2 text-xs text-warning/80 italic border-t border-warning/20 pt-2">
            "{q.heldReason}"
          </div>
        )}
        {q.status === 'rejected' && q.rejectionReason && (
          <div className="mt-2 text-xs text-destructive/80 italic border-t border-destructive/20 pt-2">
            "{q.rejectionReason}"
          </div>
        )}

        {/* Selected indicator */}
        {selected && (
          <div className="mt-2 pt-2 border-t border-primary/20 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-xs text-primary font-medium">Selected — see actions on the right</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Detail panel — NO action buttons on the question card ───────────────────

function DetailPanel({
  q,
  actionLoading,
  onAction,
}: {
  q: Question | null
  actionLoading: boolean
  onAction: (action: ReviewAction, questionText: string) => void
}) {
  const [modalAction, setModalAction] = useState<ReviewAction | null>(null)

  if (!q) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-4 text-center">
        <div className="rounded-full bg-muted p-5">
          <Eye className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">No question selected</p>
          <p className="text-xs text-muted-foreground mt-1">Select a question from the list to review</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <Badge className={cn('capitalize text-xs px-2 py-0.5', STATUS_COLORS[q.status] ?? 'bg-muted')}>
              {STATUS_LABELS[q.status] ?? q.status}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">{q.id.slice(0, 8)}…</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {q.mediaUrls && q.mediaUrls.length > 0 && (
              <span className="flex items-center gap-1"><Film className="h-3 w-3" />{q.mediaUrls.length}</span>
            )}
            {q.aiConfidenceScore != null && (
              <span className="flex items-center gap-1"><Zap className="h-3 w-3" />AI {q.aiConfidenceScore}%</span>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* Question text — prominent */}
            <div className="bg-muted/60 rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Question</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{q.questionText}</p>
            </div>

            {/* AI Confidence — large and visible */}
            {q.aiConfidenceScore != null && (
              <ConfidenceCard score={q.aiConfidenceScore} />
            )}

            {/* Held / rejection reason */}
            {q.status === 'held' && q.heldReason && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
                <p className="text-xs font-semibold text-warning uppercase tracking-wide mb-1">Hold Reason</p>
                <p className="text-sm text-foreground leading-relaxed">{q.heldReason}</p>
              </div>
            )}
            {q.status === 'rejected' && q.rejectionReason && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-xs font-semibold text-destructive uppercase tracking-wide mb-1">Rejection Reason</p>
                <p className="text-sm text-foreground leading-relaxed">{q.rejectionReason}</p>
              </div>
            )}
            {q.status === 'approved' && q.approvalReason && (
              <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                <p className="text-xs font-semibold text-success uppercase tracking-wide mb-1">Approval Reason</p>
                <p className="text-sm text-foreground leading-relaxed">{q.approvalReason}</p>
              </div>
            )}

            {/* Metadata grid — 2 cols */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Details</p>
              <div className="grid grid-cols-2 gap-3">
                <MetaItem icon={Wheat}    label="Crop"      value={q.cropType} />
                <MetaItem icon={MapPin}   label="State"     value={q.state} />
                <MetaItem icon={MapPin}   label="District"  value={q.district} />
                <MetaItem icon={Hash}     label="Language"  value={q.language?.toUpperCase()} />
                <MetaItem icon={Clock}    label="Submitted" value={formatDate(q.submittedAt)} />
                <MetaItem icon={Star}     label="Category"  value={q.domainCategory} />
              </div>
            </div>

            {/* Submitter info */}
            {q.user && (
              <div className="rounded-xl border border-border-subtle p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Submitted By</p>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2.5">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{q.user.name}</p>
                    {q.user.mobileNumber && (
                      <p className="text-xs text-muted-foreground font-mono">{q.user.mobileNumber}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Media */}
            {q.mediaUrls && q.mediaUrls.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Media ({q.mediaUrls.length})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {q.mediaUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                      {url.match(/\.(mp4|mov|avi|m4v)$/i) ? (
                        <div className="rounded-lg border bg-muted flex items-center justify-center h-28 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1.5"><Film className="h-4 w-4" /> Video</span>
                        </div>
                      ) : (
                        <img src={url} alt={`media-${i}`} className="rounded-lg border w-full h-28 object-cover hover:opacity-80 transition-opacity" />
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Previous review */}
            {q.reviewedByName && (
              <div className="rounded-xl border border-border-subtle p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Previous Review</p>
                <p className="text-sm text-foreground">
                  Reviewed by <span className="font-medium">{q.reviewedByName}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── ONLY place with action buttons ── */}
        {REVIEWABLE_STATUSES.includes(q.status) && (
          <div className="shrink-0 border-t border-border-subtle p-4 space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Choose an action — you will be asked to provide a reason before it's applied.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onAction('approve', q.questionText)}
                disabled={actionLoading}
                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-semibold bg-success/10 text-success hover:bg-success/20 border border-success/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="h-5 w-5" />
                Approve
              </button>
              <button
                onClick={() => onAction('hold', q.questionText)}
                disabled={actionLoading}
                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-semibold bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PauseCircle className="h-5 w-5" />
                Hold
              </button>
              <button
                onClick={() => onAction('reject', q.questionText)}
                disabled={actionLoading}
                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="h-5 w-5" />
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Show status for non-reviewable */}
        {!REVIEWABLE_STATUSES.includes(q.status) && (
          <div className="shrink-0 border-t border-border-subtle p-4 text-center">
            <p className="text-xs text-muted-foreground">This question has already been reviewed.</p>
          </div>
        )}
      </div>

      {/* Review reason modal */}
      {modalAction && (
        <ReviewModal
          action={modalAction}
          questionId={q.id}
          questionText={q.questionText}
          onConfirm={(id, action, reason) => {
            // Parent handles the API call; close modal
            setModalAction(null)
            // Trigger parent via onAction — but we need the modal's local state
            // Use a ref or lift state. Simpler: pass a callback that the parent wires up.
          }}
          onCancel={() => setModalAction(null)}
          loading={actionLoading}
        />
      )}
    </>
  )
}

function MetaItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

// ─── Stats filter bar ─────────────────────────────────────────────────────────

function StatsBar({ counts, activeFilter, onFilter }: {
  counts: Record<string, number>
  activeFilter: string
  onFilter: (f: string) => void
}) {
  const items = [
    { key: '',             label: 'All',         color: 'bg-muted' },
    { key: 'pending',      label: 'Pending',      color: STATUS_COLORS.pending },
    { key: 'ai_review',    label: 'AI Review',    color: STATUS_COLORS.ai_review },
    { key: 'human_review', label: 'Human Review', color: STATUS_COLORS.human_review },
    { key: 'held',         label: 'Held',         color: STATUS_COLORS.held },
  ]
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map(({ key, label, color }) => {
        const count = key ? counts[key] ?? 0 : total
        const active = activeFilter === key
        return (
          <button
            key={key}
            onClick={() => onFilter(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border',
              active
                ? 'border-primary bg-primary/[0.08] text-primary'
                : 'border-border-subtle bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground',
              count === 0 && 'opacity-40',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', color)} />
            {label}
            {count > 0 && <span className="text-[10px] tabular-nums">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ReviewsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ action: ReviewAction; questionText: string } | null>(null)
  const limit = 15
  const debouncedSearch = useDebouncedValue(search, 400)

  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const didExplicitlyDeselect = useRef(false)

  useEffect(() => {
    didExplicitlyDeselect.current = false
    setPage(1)
    setSelectedQuestion(null)
  }, [debouncedSearch, statusFilter])

  useEffect(() => {
    setLoading(true)
    curatorApi.getReviewQueue({ page, limit, status: statusFilter || undefined })
      .then((res) => {
        setQuestions(res.items as Question[])
        setTotal(res.total)
        if (selectedQuestion && !res.items.find((q: Question) => q.id === selectedQuestion.id)) {
          didExplicitlyDeselect.current = true
          setSelectedQuestion(null)
        } else if (!didExplicitlyDeselect.current && res.items.length > 0 && !selectedQuestion) {
          setSelectedQuestion(res.items[0] as Question)
        }
      })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load review queue')))
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, statusFilter])

  function doAction(id: string, action: ReviewAction, reason: string) {
    setActionLoading(true)
    curatorApi.reviewQuestion(id, {
      action,
      reason,
      ...(action === 'hold' ? { heldReason: reason } : {}),
    })
      .then((result) => {
        if (action === 'approve') {
          toast.success(result?.rewardCredited != null ? `Approved — ₹${result.rewardCredited} credited` : 'Approved')
        } else if (action === 'reject') {
          toast.success('Question rejected')
        } else {
          toast.success('Question put on hold')
        }
        setQuestions((qs) => qs.filter((q) => q.id !== id))
        setSelectedQuestion(null)
      })
      .catch((e) => toast.error(getErrorMessage(e, `Failed to ${action}`)))
      .finally(() => setActionLoading(false))
  }

  function openActionModal(action: ReviewAction, questionText: string) {
    setPendingAction({ action, questionText })
  }

  function handleModalConfirm(reason: string) {
    if (!pendingAction || !selectedQuestion) return
    doAction(selectedQuestion.id, pendingAction.action, reason)
    setPendingAction(null)
  }

  const totalPages = Math.ceil(total / limit)

  // Compute stats from all loaded questions
  const statsCounts: Record<string, number> = {}
  questions.forEach((q) => {
    statsCounts[q.status] = (statsCounts[q.status] ?? 0) + 1
  })

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Review Queue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total > 0 ? `${total} question${total === 1 ? '' : 's'} pending review` : 'No questions pending'}
          </p>
        </div>
        {/* Queue health indicator */}
        {total > 0 && (
          <div className={cn(
            'flex items-center gap-2 rounded-full px-3 py-1.5 border text-xs font-medium',
            total > 50 ? 'border-warning/40 bg-warning/10 text-warning' :
            'border-success/40 bg-success/10 text-success',
          )}>
            <div className={cn(
              'h-2 w-2 rounded-full',
              total > 50 ? 'bg-warning' : 'bg-success',
            )} />
            {total > 50 ? 'Queue is busy' : 'Queue is manageable'}
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search crop, location, keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Stats filter bar */}
      <div className="mb-4">
        <StatsBar counts={statsCounts} activeFilter={statusFilter} onFilter={(f) => { setStatusFilter(f); setPage(1) }} />
      </div>

      {/* Split panel: list + detail */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-4">
        {/* Left: question list */}
        <div className="flex flex-col min-h-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex gap-2">
                      <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                      <div className="h-5 w-16 rounded bg-muted animate-pulse" />
                    </div>
                    <div className="h-4 w-full rounded bg-muted animate-pulse" />
                    <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="rounded-full bg-success/10 p-5">
                <InboxIcon className="h-10 w-10 text-success" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">All caught up!</p>
                <p className="text-sm text-muted-foreground mt-1">No questions in this queue.</p>
              </div>
              {(search || statusFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSearch(''); setStatusFilter(''); setPage(1) }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  selected={selectedQuestion?.id === q.id}
                  onSelect={setSelectedQuestion}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-subtle shrink-0">
              <p className="text-xs text-muted-foreground">
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2 min-w-[80px] text-center tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="hidden xl:flex flex-col border border-border-subtle rounded-xl bg-surface overflow-hidden">
          <DetailPanel
            q={selectedQuestion}
            actionLoading={actionLoading}
            onAction={openActionModal}
          />
        </div>
      </div>

      {/* Reason modal — single instance, driven by pendingAction */}
      {pendingAction && selectedQuestion && (
        <ReviewModal
          action={pendingAction.action}
          questionId={selectedQuestion.id}
          questionText={pendingAction.questionText}
          onConfirm={(id, action, reason) => {
            setPendingAction(null)
            doAction(id, action, reason)
          }}
          onCancel={() => setPendingAction(null)}
          loading={actionLoading}
        />
      )}
    </div>
  )
}