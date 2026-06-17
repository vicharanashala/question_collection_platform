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
  Eye, Hash, ChevronDown,
  InboxIcon, RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-warning text-white',
  ai_review:   'bg-ai_review text-white',
  human_review:'bg-human_review text-white',
  held:        'bg-[hsl(38,92%,50%)] text-white',
  approved:    'bg-success text-white',
  rejected:    'bg-destructive text-white',
}

const STATUS_LABELS: Record<string, string> = {
  pending:     'Pending',
  ai_review:   'AI Review',
  human_review:'Human Review',
  held:        'Held',
}

const REVIEWABLE_STATUSES = ['pending', 'ai_review', 'human_review', 'held']

const SEASON_LABEL: Record<string, string> = {
  kharif: 'Kharif', rabi: 'Rabi', zaid: 'Zaid', year_round: 'Year Round',
}

// ─── Review reason inline input ──────────────────────────────────────────────

interface ReasonInputProps {
  placeholder: string
  value: string
  onChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
  confirmLabel: string
  confirmClass: string
  loading: boolean
}
function ReasonInput({ placeholder, value, onChange, onConfirm, onCancel, confirmLabel, confirmClass, loading }: ReasonInputProps) {
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <Input
        autoFocus
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" className={confirmClass} onClick={onConfirm} disabled={loading || !value.trim()}>
          {confirmLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

// ─── Question list card ───────────────────────────────────────────────────────

function QuestionCard({
  q,
  selected,
  actionLoading,
  onSelect,
  onApprove,
  onHold,
  onReject,
}: {
  q: Question
  selected: boolean
  actionLoading: string | null
  onSelect: (q: Question) => void
  onApprove: (id: string) => void
  onHold: (id: string) => void
  onReject: (id: string) => void
}) {
  const disabled = actionLoading === q.id
  return (
    <div
      className={cn(
        'group relative rounded-xl border cursor-pointer transition-all duration-150',
        selected
          ? 'border-primary bg-primary/[0.04] shadow-sm ring-1 ring-primary/20'
          : 'border-border-subtle bg-surface hover:border-primary/30 hover:shadow-sm',
        disabled && 'opacity-60 pointer-events-none',
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
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Star className="h-3 w-3 text-warning" />
                <span className="font-medium">{q.aiConfidenceScore}%</span>
              </span>
            )}
            {q.domainCategory && (
              <span className="text-xs font-medium text-info bg-info/10 px-2 py-0.5 rounded-full capitalize">
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
        </div>

        {/* Held reason — shown when held and has reason */}
        {q.status === 'held' && q.heldReason && (
          <div className="mt-2 text-xs text-warning/80 italic border-t border-warning/20 pt-2">
            "{q.heldReason}"
          </div>
        )}

        {/* Quick actions — visible on hover or when selected */}
        {REVIEWABLE_STATUSES.includes(q.status) && (
          <div
            className={cn(
              'flex items-center gap-2 mt-3 pt-3 border-t border-border-subtle',
              'transition-opacity duration-150',
              selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(q.id) }}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-success/10 text-success hover:bg-success/20 border border-success/20 transition-colors disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Approve
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onHold(q.id) }}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-warning/10 text-warning hover:bg-warning/20 border border-warning/20 transition-colors disabled:opacity-50"
            >
              <PauseCircle className="h-3.5 w-3.5" /> Hold
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(q.id) }}
              disabled={disabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 transition-colors disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  q,
  actionLoading,
  onApprove,
  onHold,
  onReject,
  selectedId,
  onClear,
}: {
  q: Question | null
  actionLoading: string | null
  onApprove: (id: string, reason: string) => void
  onHold: (id: string, reason: string) => void
  onReject: (id: string, reason: string) => void
  selectedId: string | null
  onClear: () => void
}) {
  const [mode, setMode] = useState<'idle' | 'approve' | 'hold' | 'reject'>('idle')
  const [reason, setReason] = useState('')

  useEffect(() => { setMode('idle'); setReason('') }, [q?.id])

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

  function confirm() {
    if (!reason.trim()) { toast.error('Reason is required'); return }
    if (mode === 'approve') onApprove(q.id, reason.trim())
    else if (mode === 'reject') onReject(q.id, reason.trim())
    else if (mode === 'hold') onHold(q.id, reason.trim())
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <Badge className={cn('capitalize text-xs px-2 py-0.5', STATUS_COLORS[q.status] ?? 'bg-muted')}>
            {STATUS_LABELS[q.status] ?? q.status}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">{q.id.slice(0, 8)}…</span>
        </div>
        {q.mediaUrls && q.mediaUrls.length > 0 && (
          <span className="text-xs text-muted-foreground">{q.mediaUrls.length} media</span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 space-y-5">
          {/* Question text */}
          <div className="bg-muted/60 rounded-xl p-4">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{q.questionText}</p>
          </div>

          {/* Held reason */}
          {q.status === 'held' && q.heldReason && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
              <p className="text-xs font-semibold text-warning uppercase tracking-wide mb-1">Hold Reason</p>
              <p className="text-sm text-foreground leading-relaxed">{q.heldReason}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <MetaItem icon={Wheat} label="Crop" value={q.cropType} />
            <MetaItem icon={MapPin} label="State" value={q.state} />
            <MetaItem icon={MapPin} label="District" value={q.district} />
            <MetaItem icon={Clock} label="Submitted" value={formatDate(q.submittedAt)} />
            <MetaItem icon={Star} label="AI Confidence" value={q.aiConfidenceScore != null ? `${q.aiConfidenceScore}%` : null} />
            <MetaItem icon={Hash} label="Language" value={q.language?.toUpperCase()} />
          </div>

          {/* Media */}
          {q.mediaUrls && q.mediaUrls.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Media</p>
              <div className="grid grid-cols-3 gap-2">
                {q.mediaUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`media-${i}`} className="rounded-lg border w-full h-20 object-cover hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky action footer */}
      {REVIEWABLE_STATUSES.includes(q.status) && (
        <div className="shrink-0 border-t border-border-subtle p-4 space-y-3 bg-surface">
          {mode === 'idle' ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-success hover:bg-success/90"
                onClick={() => setMode('approve')}
                disabled={!!actionLoading}
              >
                <CheckCircle className="h-4 w-4" /> Approve
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-warning hover:bg-warning/90 text-white"
                onClick={() => setMode('hold')}
                disabled={!!actionLoading}
              >
                <PauseCircle className="h-4 w-4" /> Hold
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => setMode('reject')}
                disabled={!!actionLoading}
              >
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                {mode === 'approve' && 'Provide a reason for approval'}
                {mode === 'reject' && 'Provide a reason for rejection (visible to farmer)'}
                {mode === 'hold' && 'Provide a reason for holding this question'}
              </p>
              <Input
                autoFocus
                placeholder={
                  mode === 'approve' ? 'e.g., Clear and actionable question...' :
                  mode === 'reject' ? 'e.g., Off-topic, duplicate, insufficient detail...' :
                  'e.g., Awaiting expert review...'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirm()
                  if (e.key === 'Escape') { setMode('idle'); setReason('') }
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className={cn(
                    mode === 'approve' ? 'bg-success hover:bg-success/90' :
                    mode === 'reject' ? '' : 'bg-warning hover:bg-warning/90 text-white',
                    mode === 'reject' && 'bg-destructive hover:bg-destructive/90',
                  )}
                  onClick={confirm}
                  disabled={!!actionLoading || !reason.trim()}
                >
                  Confirm {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setMode('idle'); setReason('') }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
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

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ counts, activeFilter, onFilter }: {
  counts: Record<string, number>
  activeFilter: string
  onFilter: (f: string) => void
}) {
  const items = [
    { key: '', label: 'All', color: 'bg-muted' },
    { key: 'pending', label: 'Pending', color: STATUS_COLORS.pending },
    { key: 'ai_review', label: 'AI Review', color: STATUS_COLORS.ai_review },
    { key: 'human_review', label: 'Human Review', color: STATUS_COLORS.human_review },
    { key: 'held', label: 'Held', color: STATUS_COLORS.held },
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
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const limit = 10
  const debouncedSearch = useDebouncedValue(search, 400)

  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const didExplicitlyDeselect = useRef(false)

  // Reset to page 1 whenever search or status filter changes
  useEffect(() => {
    didExplicitlyDeselect.current = false
    setPage(1)
    setSelectedQuestion(null)
  }, [debouncedSearch, statusFilter])

  useEffect(() => {
    setLoading(true)
    curatorApi.getReviewQueue({ page, limit, status: statusFilter || undefined, search: debouncedSearch || undefined })
      .then((res) => {
        setQuestions(res.items as Question[])
        setTotal(res.total)
        // If selected question is no longer in list, deselect it; otherwise auto-select first if nothing was explicitly deselected
        if (selectedQuestion && !res.items.find((q: Question) => q.id === selectedQuestion.id)) {
          didExplicitlyDeselect.current = true
          setSelectedQuestion(null)
        } else if (!didExplicitlyDeselect.current && res.items.length > 0) {
          setSelectedQuestion(res.items[0] as Question)
        }
      })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load review queue')))
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, statusFilter])

  function doAction(id: string, action: 'approve' | 'hold' | 'reject', reason: string) {
    setActionLoading(id)
    curatorApi.reviewQuestion(id, {
      action,
      reason,
      ...(action === 'hold' ? { heldReason: reason } : {}),
    })
      .then((result) => {
        if (action === 'approve') {
          toast.success(result?.rewardCredited != null ? `Approved — ₹${result.rewardCredited} credited` : 'Approved')
        } else if (action === 'reject') {
          toast.success('Rejected')
        } else {
          toast.success('Put on hold')
        }
        setQuestions((qs) => qs.filter((q) => q.id !== id))
        setSelectedQuestion(null)
      })
      .catch((e) => toast.error(getErrorMessage(e, `Failed to ${action}`)))
      .finally(() => setActionLoading(null))
  }

  const totalPages = Math.ceil(total / limit)

  // Compute stats from current list (approximation — backend could provide exact counts)
  const statsCounts: Record<string, number> = {}
  questions.forEach((q) => {
    statsCounts[q.status] = (statsCounts[q.status] ?? 0) + 1
  })

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* ─── Page header ─── */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Review Queue</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total > 0 ? `${total} question${total === 1 ? '' : 's'} total` : 'No questions pending'}
          </p>
        </div>
      </div>

      {/* ─── Search bar ─── */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search crop, location, keyword..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* ─── Stats filter bar ─── */}
      <div className="mb-4">
        <StatsBar counts={statsCounts} activeFilter={statusFilter} onFilter={(f) => { setStatusFilter(f); setPage(1) }} />
      </div>

      {/* ─── Split panel ─── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
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
                  actionLoading={actionLoading}
                  onSelect={setSelectedQuestion}
                  onApprove={(id) => {
                    setSelectedQuestion(q)
                    doAction(id, 'approve', 'Approved')
                  }}
                  onHold={(id) => {
                    setSelectedQuestion(q)
                    doAction(id, 'hold', 'Put on hold for review')
                  }}
                  onReject={(id) => {
                    setSelectedQuestion(q)
                    doAction(id, 'reject', 'Rejected')
                  }}
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

        {/* Right: detail panel (hidden on mobile, shown on lg+) */}
        <div className="hidden lg:flex flex-col border border-border-subtle rounded-xl bg-surface overflow-hidden">
          <DetailPanel
            q={selectedQuestion}
            actionLoading={actionLoading}
            onApprove={(id, reason) => doAction(id, 'approve', reason)}
            onHold={(id, reason) => doAction(id, 'hold', reason)}
            onReject={(id, reason) => doAction(id, 'reject', reason)}
            selectedId={selectedQuestion?.id ?? null}
            onClear={() => setSelectedQuestion(null)}
          />
        </div>
      </div>
    </div>
  )
}