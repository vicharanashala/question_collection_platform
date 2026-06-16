import { useState, useEffect } from 'react'
import { questionApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatDate } from '@/lib/utils'
import {
  Search, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  MessageSquare, Clock, User, Eye, Star,
  MapPin, Wheat, CloudRain, Globe, Film,
  Hash, AlertTriangle, PauseCircle,
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

export function QuestionsPage() {
  const { user } = useAuth()
  const canModerate = ['curator', 'admin', 'super_admin'].includes(user?.role ?? '')
  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const limit = 20
  const debouncedSearch = useDebouncedValue(search, 400)

  // Question detail dialog
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null)
  // Separate open state so closing the dialog (onOpenChange) clears detailQuestion cleanly
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    questionApi.getQuestions({ page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined })
      .then((res) => { setQuestions(res.items as Question[]); setTotal(res.total) })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load questions')))
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, statusFilter])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-foreground">Questions</h2>
        <p className="text-sm text-muted-foreground">{total.toLocaleString()} total questions</p>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by crop type..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9 !bg-surface-variant dark:!bg-surface-variant"
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-surface-variant px-3 text-sm text-text !bg-surface-variant dark:!bg-surface-variant dark:border-border-subtle"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="ai_review">AI Review</option>
            <option value="human_review">Human Review</option>
            <option value="held">Held</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </Card>

      {/* Questions list */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-5">
              <div className="h-5 w-3/4 rounded bg-muted animate-pulse mb-3" />
              <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
            </Card>
          ))
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No questions found</p>
          </div>
        ) : (
          questions.map((q) => (
            <Card
              key={q.id}
              className="overflow-hidden hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => { setDetailQuestion(q); setDetailOpen(true) }}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground leading-relaxed">{q.questionText}</p>

                    {/* Meta row */}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Badge className={cn('capitalize', STATUS_COLORS[q.status] ?? 'bg-muted')}>
                        {q.status.replace('_', ' ')}
                      </Badge>
                      {q.domainCategory && (
                        <span className="text-xs text-muted-foreground">{q.domainCategory}</span>
                      )}
                      {q.cropType && (
                        <span className="text-xs text-muted-foreground">{q.cropType}</span>
                      )}
                      {q.season && (
                        <span className="text-xs text-muted-foreground capitalize">{q.season}</span>
                      )}
                      {q.state && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" /> {q.state}{q.district ? `, ${q.district}` : ''}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {formatDate(q.submittedAt)}
                      </span>
                      {q.aiConfidenceScore != null && (
                        <span className="text-xs text-muted-foreground">
                          AI conf: {q.aiConfidenceScore}%
                        </span>
                      )}
                    </div>

                    {q.rejectionReason && (
                      <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        <p className="text-xs text-destructive">{q.rejectionReason}</p>
                      </div>
                    )}
                  </div>

                  {/* Quick status actions — only for moderators */}
                  {canModerate && (
                    <div className="flex flex-col gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-primary border-primary/50 hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); setDetailQuestion(q); setDetailOpen(true) }}
                      >
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                      {q.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-success border border-success/50 hover:bg-success/10"
                            onClick={() => questionApi.approveQuestion(q.id).then(() => {
                              setQuestions((qs) => qs.map((qq) => qq.id === q.id ? { ...qq, status: 'approved' as const } : qq))
                              toast.success('Question approved')
                            }).catch((e) => toast.error(getErrorMessage(e, 'Failed to approve')))}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border border-destructive/50 hover:bg-destructive/10"
                            onClick={() => {
                              const reason = window.prompt('Rejection reason (optional):')
                              questionApi.rejectQuestion(q.id, reason ?? undefined).then(() => {
                                setQuestions((qs) => qs.map((qq) => qq.id === q.id ? { ...qq, status: 'rejected' as const } : qq))
                                toast.success('Question rejected')
                              }).catch((e) => toast.error(getErrorMessage(e, 'Failed to reject')))
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Reject
                          </Button>
                        </>
                      )}
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

      {/* ─── Question Detail Dialog ─── */}
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
                {detailQuestion.reviewerId && (
                  <InfoRow icon={User} label="Reviewer ID" value={<span className="font-mono text-xs">{detailQuestion.reviewerId.slice(0, 8)}…</span>} />
                )}
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

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}