import { useState, useEffect, useRef } from 'react'
import { curatorApi, getErrorMessage } from '@/api/client'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatDate } from '@/lib/utils'
import {
  CheckCircle, XCircle, PauseCircle,
  Search,
  Clock, Star,
  MapPin, Wheat, Film, Eye, Hash,
  User, Zap, ThumbsUp, Ban, ListFilter,
  Tag, Globe,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Question, QuestionStatus } from '@/types'
import { TranslatableText } from '@/components/TranslatableText'
import {
  DataTable, CardView,
  type ColumnDef,
} from '@/components/DataTable'

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

  const SUGGESTED_REASONS: Record<ReviewAction, string[]> = {
    approve: [
      'Clear crop context with specific variety and growth stage',
      'Actionable query that can be answered with agricultural expertise',
      'Sufficient detail provided — location, crop, and issue clearly stated',
      'Relevant to farming community — pest, nutrition, or weather query',
      'Duplicate of a valid question but well-formed and worth approving',
    ],
    reject: [
      'Off-topic — not related to agriculture or farming',
      'Duplicate question already answered in the database',
      'Insufficient detail — crop, location, or issue not specified',
      'Inappropriate content — abusive, promotional, or irrelevant',
      'Unintelligible — cannot understand the query from the text',
      'Opinion-seeking — not a factual or actionable question',
    ],
    hold: [
      'Requires expert domain knowledge beyond general farming advice',
      'Crop context unclear — needs clarification on variety or region',
      'Ambiguous symptoms — could be multiple issues, needs more info',
      'Sensitive or region-specific query that needs local expert review',
      'Complex multi-part question — split and re-submit recommended',
    ],
  }

  function appendReason(suggestion: string) {
    setReason((prev) => (prev ? `${prev}\n${suggestion}` : suggestion))
    textareaRef.current?.focus()
  }

  function selectOnly(suggestion: string) {
    setReason(suggestion)
    textareaRef.current?.focus()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-lg bg-surface rounded-2xl shadow-2xl border border-border-subtle overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className={cn(
          'flex items-center gap-3 px-6 py-4 shrink-0',
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
        <div className="px-6 py-3 border-b border-border-subtle bg-muted/30 shrink-0">
          <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Question</p>
          <p className="text-sm text-foreground leading-relaxed line-clamp-3">{questionText}</p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Suggested reasons */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Suggested reasons <span className="text-muted-foreground/60 font-normal">(click to use)</span>
            </p>
            <div className="space-y-1.5">
              {SUGGESTED_REASONS[action].map((suggestion, i) => (
                <div key={i} className="flex items-start gap-2">
                  <button
                    className={cn(
                      'flex-1 text-left text-xs px-3 py-2 rounded-lg border transition-all duration-150',
                      'hover:shadow-sm cursor-pointer text-left',
                      isApprove
                        ? 'border-success/20 bg-success/5 text-success hover:bg-success/10 hover:border-success/40'
                        : isReject
                        ? 'border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:border-destructive/40'
                        : 'border-warning/20 bg-warning/5 text-warning hover:bg-warning/10 hover:border-warning/40',
                    )}
                    onClick={() => selectOnly(suggestion)}
                    title="Replace reason with this suggestion"
                  >
                    {suggestion}
                  </button>
                  <button
                    className={cn(
                      'shrink-0 text-xs px-2 py-1.5 rounded border transition-all duration-150 cursor-pointer',
                      'text-muted-foreground border-border-subtle hover:bg-muted hover:text-foreground',
                    )}
                    onClick={() => appendReason(suggestion)}
                    title="Add as additional reason"
                  >
                    +Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Custom reason textarea */}
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">
              Custom Reason <span className="text-muted-foreground/60 font-normal text-xs">(or write your own)</span>
            </Label>
            <textarea
              ref={textareaRef}
              rows={4}
              placeholder={
                isApprove ? 'Describe why this question is approved...' :
                isReject  ? 'Describe why this question is rejected...' :
                            'Describe why this question needs further review...'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Be specific — a clear reason helps farmers understand the outcome and curators maintain quality.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-subtle bg-muted/20 shrink-0">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
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

// ─── Confidence Card ──────────────────────────────────────────────────────────

function ConfidenceCard({ score }: { score: number }) {
  const color = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'destructive'
  const colorClass = color === 'success' ? 'text-success' : color === 'warning' ? 'text-warning' : 'text-destructive'
  const bgClass    = color === 'success' ? 'border-success/30 bg-success/5' :
                     color === 'warning' ? 'border-warning/30 bg-warning/5' :
                                          'border-destructive/30 bg-destructive/5'
  const barClass   = color === 'success' ? 'bg-success' : color === 'warning' ? 'bg-warning' : 'bg-destructive'
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

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  q,
  actionLoading,
  onAction,
  selectedLang,
  onLangChange,
}: {
  q: Question | null
  actionLoading: boolean
  onAction: (action: ReviewAction, questionText: string) => void
  selectedLang: string
  onLangChange: (lang: string) => void
}) {
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <Badge className={cn('capitalize text-xs px-2 py-0.5', STATUS_COLORS[q.status] ?? 'bg-muted')}>
            {STATUS_LABELS[q.status] ?? q.status}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">{q.id.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {q.mediaUrls && q.mediaUrls.length > 0 && <span className="flex items-center gap-1"><Film className="h-3 w-3" />{q.mediaUrls.length}</span>}
          {q.aiConfidenceScore != null && <span className="flex items-center gap-1"><Zap className="h-3 w-3" />AI {q.aiConfidenceScore}%</span>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">
          <div className="bg-muted/60 rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Question</p>
            <TranslatableText
              text={q.questionText}
              selectedLang={selectedLang}
              onLangChange={onLangChange}
              sourceLanguage={q.language ?? 'en'}
              inline
            />
          </div>

          {q.aiConfidenceScore != null && <ConfidenceCard score={q.aiConfidenceScore} />}

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

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Details</p>
            <div className="grid grid-cols-2 gap-3">
              <MetaItem icon={Star}    label="Category" value={(q.domains ?? []).join(', ') || '—'} />
              <MetaItem icon={Wheat}   label="Crop"     value={q.cropType} />
              <MetaItem icon={Hash}    label="Season"   value={q.season} />
              <MetaItem icon={MapPin}  label="State"    value={q.state} />
              <MetaItem icon={MapPin}  label="District" value={q.district} />
              {q.block && <MetaItem icon={MapPin} label="Block" value={q.block} />}
              <MetaItem icon={Globe}   label="Language" value={q.language?.toUpperCase()} />
              <MetaItem icon={Clock}   label="Submitted" value={formatDate(q.submittedAt)} />
            </div>
          </div>

          {q.user && (
            <div className="rounded-xl border border-border-subtle p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Submitted By</p>
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2.5"><User className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{q.user.name}</p>
                  {q.user.mobileNumber && <p className="text-xs text-muted-foreground font-mono">{q.user.mobileNumber}</p>}
                </div>
              </div>
            </div>
          )}

          {q.mediaUrls && q.mediaUrls.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Media ({q.mediaUrls.length})</p>
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

          {q.reviewedByName && (
            <div className="rounded-xl border border-border-subtle p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Previous Review</p>
              <p className="text-sm text-foreground">Reviewed by <span className="font-medium">{q.reviewedByName}</span></p>
            </div>
          )}
        </div>
      </div>

      {REVIEWABLE_STATUSES.includes(q.status) && (
        <div className="shrink-0 border-t border-border-subtle p-4 space-y-3">
          <p className="text-xs text-muted-foreground text-center">Choose an action — you will be asked to provide a reason.</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => onAction('approve', q.questionText)} disabled={actionLoading}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-semibold bg-success/10 text-success hover:bg-success/20 border border-success/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <CheckCircle className="h-5 w-5" /> Approve
            </button>
            <button onClick={() => onAction('hold', q.questionText)} disabled={actionLoading}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-semibold bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <PauseCircle className="h-5 w-5" /> Hold
            </button>
            <button onClick={() => onAction('reject', q.questionText)} disabled={actionLoading}
              className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <XCircle className="h-5 w-5" /> Reject
            </button>
          </div>
        </div>
      )}

      {!REVIEWABLE_STATUSES.includes(q.status) && (
        <div className="shrink-0 border-t border-border-subtle p-4 text-center">
          <p className="text-xs text-muted-foreground">This question has already been reviewed.</p>
        </div>
      )}
    </div>
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

// ─── Question list columns (shared between table + card) ──────────────────────

function buildListColumns(): ColumnDef<Question>[] {
  return [
    {
      key: 'status', header: 'Status', width: '120px',
      render: (q) => (
        <Badge className={cn('capitalize text-xs px-2 py-0.5 whitespace-nowrap', STATUS_COLORS[q.status] ?? 'bg-muted')}>
          {STATUS_LABELS[q.status] ?? q.status}
        </Badge>
      ),
    },
    {
      key: 'questionText', header: 'Question', width: '300px',
      render: (q) => <span className="line-clamp-2 text-xs">{q.questionText}</span>,
    },
    {
      key: 'cropType', header: 'Crop', width: '100px',
      render: (q) => <span className="text-xs capitalize">{q.cropType ?? '—'}</span>,
    },
    {
      key: 'location', header: 'Location', width: '130px',
      render: (q) => (
        <span className="text-xs truncate block" title={[q.district, q.state].filter(Boolean).join(', ')}>
          {[q.district, q.state].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'aiConfidenceScore', header: 'AI Score', width: '90px',
      render: (q) => q.aiConfidenceScore != null ? (
        <span className={cn('text-xs font-medium tabular-nums',
          q.aiConfidenceScore >= 80 ? 'text-success' : q.aiConfidenceScore >= 50 ? 'text-warning' : 'text-destructive'
        )}>{q.aiConfidenceScore}%</span>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'submittedAt', header: 'Submitted', width: '110px',
      render: (q) => <span className="text-xs text-muted-foreground">{formatDate(q.submittedAt)}</span>,
    },
    {
      key: 'media', header: 'Media', width: '60px',
      render: (q) => q.mediaUrls && q.mediaUrls.length > 0
        ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Film className="h-3 w-3" />{q.mediaUrls.length}</span>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
  ]
}

// ─── Status filter chips ──────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
  { value: '',              label: 'All' },
  { value: 'pending',       label: 'Pending' },
  { value: 'ai_review',     label: 'AI Review' },
  { value: 'human_review',  label: 'Human Review' },
  { value: 'held',          label: 'Held' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export function ReviewsPage() {
  const [questions, setQuestions]     = useState<Question[]>([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<{ action: ReviewAction; questionText: string } | null>(null)
  const [view]                       = useState<'table' | 'card'>('card')
  const [langByQuestionId, setLangByQuestionId] = useState<Record<string, string>>({})
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const didExplicitlyDeselect = useRef(false)

  const limit = 15
  const debouncedSearch = useDebouncedValue(search, 400)

  const getLang = (id: string) => langByQuestionId[id] ?? ''
  const setLang = (id: string, lang: string) => setLangByQuestionId((prev) => ({ ...prev, [id]: lang }))

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
        setQuestions((qs) => {
          const remaining = qs.filter((q) => q.id !== id)
          setSelectedQuestion(remaining[0] ?? null)
          return remaining
        })
      })
      .catch((e) => toast.error(getErrorMessage(e, `Failed to ${action}`)))
      .finally(() => setActionLoading(false))
  }

  function openActionModal(action: ReviewAction, questionText: string) {
    setPendingAction({ action, questionText })
  }

  const totalPages = Math.ceil(total / limit)
  const columns = buildListColumns()

  const emptyMessage = search || statusFilter ? 'No questions match your filters' : 'No questions in queue'

  const tableComponent = (
    <DataTable
      data={questions}
      columns={columns}
      loading={loading}
      page={page}
      totalPages={totalPages}
      totalCount={total}
      searchValue={search}
      onSearchChange={setSearch}
      onPageChange={setPage}
      SkeletonRows={5}
      emptyMessage={emptyMessage}
      onRowClick={(row) => setSelectedQuestion(row as Question)}
    />
  )

  const cardComponent = (
    <CardView
      data={questions}
      columns={columns}
      loading={loading}
      page={page}
      totalPages={totalPages}
      totalCount={total}
      onPageChange={setPage}
      SkeletonRows={6}
      emptyMessage={emptyMessage}
      onRowClick={(row) => setSelectedQuestion(row as Question)}
      selectedId={selectedQuestion?.id}
    />
  )

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
        <div className="flex items-center gap-3">
          {total > 0 && (
            <div className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 border text-xs font-medium',
              total > 50 ? 'border-warning/40 bg-warning/10 text-warning' : 'border-success/40 bg-success/10 text-success',
            )}>
              <div className={cn('h-2 w-2 rounded-full', total > 50 ? 'bg-warning' : 'bg-success')} />
              {total > 50 ? 'Queue is busy' : 'Queue is manageable'}
            </div>
          )}

        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search crop, location, keyword..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="pl-9"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <ListFilter className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => { setStatusFilter(value); setPage(1) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                statusFilter === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border-subtle bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground',
              )}
            >
              {value !== '' && <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_COLORS[value])} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Body: list + detail panel */}
      <div className="flex-1 flex gap-4 min-h-0 h-full">
        {/* Left: question list */}
        <div className="flex-1 min-w-0 flex flex-col">
          {view === 'card' ? cardComponent : tableComponent}
        </div>

        {/* Right: detail panel */}
        <div className="hidden xl:flex flex-col border-l-2 border-border rounded-xl bg-surface overflow-hidden w-80 shrink-0 h-full">
          <DetailPanel
            q={selectedQuestion}
            actionLoading={actionLoading}
            onAction={openActionModal}
            selectedLang={getLang(selectedQuestion?.id ?? '')}
            onLangChange={(lang) => selectedQuestion && setLang(selectedQuestion.id, lang)}
          />
        </div>
      </div>

      {/* Reason modal */}
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