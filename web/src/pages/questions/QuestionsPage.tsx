import { useState, useEffect } from 'react'
import { questionApi, getErrorMessage } from '@/api/client'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatDate } from '@/lib/utils'
import {
  Search, ChevronLeft, ChevronRight,
  MessageSquare, Clock, User, Eye, Star,
  MapPin, Wheat, CloudRain, Globe, Film,
  Hash, AlertTriangle, PauseCircle, ChevronDown,
  CheckCircle, XCircle, ListFilter,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types'
import { TranslatableText } from '@/components/TranslatableText'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  held: 'bg-[hsl(38,92%,50%)] text-white',
  approved: 'bg-success text-white',
  rejected: 'bg-destructive text-white',
}

const STATUS_LABELS: Record<string, string> = {
  held: 'Held',
  approved: 'Approved',
  rejected: 'Rejected',
}

// Pending / ai_review / human_review are filtered out — they belong in the review queue
const NON_LISTED_STATUSES = ['pending', 'ai_review', 'human_review']

const SEASON_LABEL: Record<string, string> = {
  kharif: 'Kharif',
  rabi: 'Rabi',
  zaid: 'Zaid',
  year_round: 'Year Round',
}

// ─── Detail dialog InfoRow helper ────────────────────────────────────────────

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

// ─── Status reason strip ─────────────────────────────────────────────────────

function ReasonStrip({ status, reason, reviewerName }: { status: string; reason: string; reviewerName?: string }) {
  const configs = {
    rejected: { icon: XCircle, cls: 'border-destructive/30 bg-destructive/5 text-destructive' },
    held:     { icon: PauseCircle, cls: 'border-warning/30 bg-warning/5 text-warning' },
    approved: { icon: CheckCircle, cls: 'border-success/30 bg-success/5 text-success' },
  }
  const cfg = configs[status as keyof typeof configs]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <div className={cn('mx-4 mb-4 rounded-md border px-3 py-2 flex items-start gap-2', cfg.cls)}>
      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium line-clamp-1">{reason}</p>
        {reviewerName && (
          <p className="text-xs opacity-70 mt-0.5">by {reviewerName}</p>
        )}
      </div>
    </div>
  )
}

// ─── Question card ────────────────────────────────────────────────────────────

function QuestionCard({ q, onOpen, selectedLang, onLangChange }: { q: Question; onOpen: (q: Question) => void; selectedLang: string; onLangChange: (lang: string) => void })
  return (
    <Card
      className="group overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer"
      onClick={() => onOpen(q)}
    >
      <CardContent className="p-0">
        {/* Header row: user info + status badge */}
        <div className="flex items-start justify-between gap-3 p-4 pb-3">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('capitalize text-xs px-2 py-0.5', STATUS_COLORS[q.status] ?? 'bg-muted')}>
                {STATUS_LABELS[q.status] ?? q.status}
              </Badge>
              {q.domainCategory && (
                <span className="text-xs font-medium text-info bg-info/10 px-2 py-0.5 rounded-full capitalize">
                  {q.domainCategory}
                </span>
              )}
              {q.aiConfidenceScore != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 text-warning" />
                  <span className="font-medium">{q.aiConfidenceScore}%</span>
                </span>
              )}
            </div>
            <span className="text-sm font-semibold text-foreground truncate">
              {q.user?.name ?? q.userName ?? q.user?.mobileNumber ?? q.userMobileNumber ?? 'Unknown'}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs text-muted-foreground">{formatDate(q.submittedAt)}</span>
            <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Question text */}
        <div className="px-4 pb-3">
          <TranslatableText
            text={q.questionText}
            selectedLang={selectedLang}
            onLangChange={onLangChange}
            sourceLanguage={q.language ?? 'en'}
            className="!space-y-1"
          />
        </div>

        {/* Footer: crop / season / location / media */}
        <div className="flex items-center justify-between gap-3 px-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            {q.cropType && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Wheat className="h-3 w-3" /> {q.cropType}
              </span>
            )}
            {q.season && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                <CloudRain className="h-3 w-3" /> {SEASON_LABEL[q.season] ?? q.season}
              </span>
            )}
            {(q.state || q.district) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {[q.district, q.state].filter(Boolean).join(', ')}
              </span>
            )}
            {q.mediaUrls && q.mediaUrls.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Film className="h-3 w-3" /> {q.mediaUrls.length} media
              </span>
            )}
          </div>
        </div>

        {/* Status reason strip */}
        {(q.status === 'rejected' || q.status === 'held' || q.status === 'approved') &&
          ((q.rejectionReason && q.status === 'rejected') ||
           (q.heldReason && q.status === 'held') ||
           (q.approvalReason && q.status === 'approved')) && (
            <ReasonStrip
              status={q.status}
              reason={
                q.status === 'rejected' ? q.rejectionReason! :
                q.status === 'held'     ? q.heldReason! :
                                          q.approvalReason!
              }
              reviewerName={q.reviewedByName}
            />
          )}
      </CardContent>
    </Card>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function QuestionCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-20 rounded bg-muted animate-pulse" />
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-full rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  )
}

// ─── Questions page ───────────────────────────────────────────────────────────

export function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const limit = 10
  const debouncedSearch = useDebouncedValue(search, 400)

  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [apiTotal, setApiTotal] = useState(0)
  const [selectedLang, setSelectedLang] = useState('')

  // Reset to page 1 whenever search or status filter changes
  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter])

  useEffect(() => {
    setLoading(true)
    questionApi.getQuestions({ page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined })
      .then((res) => {
        const visible = (res.items as Question[]).filter((q) => !NON_LISTED_STATUSES.includes(q.status))
        setQuestions(visible)
        setTotal(res.total)
        setApiTotal(res.total)
      })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load questions')))
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, statusFilter])

  const totalPages = Math.ceil(apiTotal / limit)
  const isEmpty = !loading && questions.length === 0

  return (
    <div className="space-y-5">
      {/* ─── Page header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Reviewed Questions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Questions that have been approved, rejected, or held
          </p>
        </div>
        <div className="flex items-center gap-2">
          {apiTotal > 0 && (
            <span className="text-xs text-muted-foreground">{apiTotal.toLocaleString()} total</span>
          )}
          <Badge variant="secondary" className="text-xs">{apiTotal.toLocaleString()} total</Badge>
        </div>
      </div>

      {/* ─── Search + filter bar ─── */}
      <Card>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by crop type, keyword, or location..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <div className="relative">
            <ListFilter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <select
              className="h-10 rounded-md border border-border-subtle bg-surface pl-9 pr-8 text-sm text-text appearance-none cursor-pointer"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            >
              <option value="">All statuses</option>
              <option value="held">Held</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </Card>

      {/* ─── Questions list ─── */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <QuestionCardSkeleton key={i} />)
        ) : isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">No questions found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {search || statusFilter
                    ? 'Try adjusting your search or filters'
                    : 'No reviewed questions in the system yet'}
                </p>
              </div>
              {(search || statusFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSearch(''); setStatusFilter(''); setPage(1) }}
                >
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          questions.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              onOpen={(qq) => { setDetailQuestion(qq); setDetailOpen(true) }}
              selectedLang={selectedLang}
              onLangChange={setSelectedLang}
            />
          ))
        )}
      </div>

      {/* ─── Pagination ─── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {(page - 1) * limit + 1}–{Math.min(page * limit, apiTotal)} of {apiTotal.toLocaleString()}
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

      {/* ─── Question detail dialog ─── */}
      {detailQuestion && (
        <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) { setDetailOpen(false); setDetailQuestion(null) } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" /> Question Details
              </DialogTitle>
              <DialogDescription>
                Full information for the selected question.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Status + category row */}
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

              {/* Question text */}
              <div className="bg-muted/50 rounded-lg p-4">
                <TranslatableText
                  text={detailQuestion.questionText}
                  selectedLang={selectedLang}
                  onLangChange={setSelectedLang}
                  sourceLanguage={detailQuestion.language ?? 'en'}
                  inline
                />
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
                <InfoRow icon={User} label="Submitted By" value={detailQuestion.user?.name ?? detailQuestion.userName ?? '—'} />
                <InfoRow icon={Clock} label="Submitted" value={formatDate(detailQuestion.submittedAt)} />
                {detailQuestion.reviewedAt && <InfoRow icon={Clock} label="Reviewed" value={formatDate(detailQuestion.reviewedAt)} />}
                {detailQuestion.reviewedByName && <InfoRow icon={User} label="Reviewed By" value={detailQuestion.reviewedByName} />}
                {detailQuestion.rejectionReason && (
                  <div className="col-span-2 mt-1">
                    <InfoRow icon={XCircle} label="Rejection Reason" value={detailQuestion.rejectionReason} />
                  </div>
                )}
                {detailQuestion.approvalReason && (
                  <div className="col-span-2 mt-1">
                    <InfoRow icon={CheckCircle} label="Approval Reason" value={detailQuestion.approvalReason} />
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

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}