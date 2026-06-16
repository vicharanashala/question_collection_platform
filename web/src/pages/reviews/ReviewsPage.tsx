import { useState, useEffect } from 'react'
import { curatorApi, questionApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import {
  CheckCircle, XCircle,
  MessageSquare, ChevronLeft, ChevronRight,
  Clock, User, Star,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning text-white',
  ai_review: 'bg-ai_review text-white',
  human_review: 'bg-human_review text-white',
  approved: 'bg-success text-white',
  rejected: 'bg-destructive text-white',
}

export function ReviewsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const limit = 20

  useEffect(() => {
    setLoading(true)
    curatorApi.getReviewQueue({ page, limit, status: statusFilter || undefined })
      .then((res) => { setQuestions(res.items as Question[]); setTotal(res.total) })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load review queue')))
      .finally(() => setLoading(false))
  }, [page, statusFilter])

  async function handleApprove(id: string) {
    setActionLoading(id)
    try {
      await questionApi.approveQuestion(id)
      toast.success('Question approved')
      setQuestions((qs) => qs.filter((q) => q.id !== id))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to approve'))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(id: string) {
    setActionLoading(id)
    try {
      await questionApi.rejectQuestion(id)
      toast.success('Question rejected')
      setQuestions((qs) => qs.filter((q) => q.id !== id))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to reject'))
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

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
          </div>
          <select
            className="ml-auto h-9 rounded-md border border-input bg-surface-variant px-3 text-sm text-text !bg-surface-variant dark:!bg-surface-variant dark:border-border-subtle"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Queues</option>
            <option value="pending">Pending</option>
            <option value="ai_review">AI Review</option>
            <option value="human_review">Human Review</option>
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
            <Card key={q.id} className="overflow-hidden">
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

                {/* Action buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-success hover:bg-success/90"
                    onClick={() => handleApprove(q.id)}
                    disabled={actionLoading === q.id}
                    title="Approve"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(q.id)}
                    disabled={actionLoading === q.id}
                    title="Reject"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
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
    </div>
  )
}