import { useState, useEffect } from 'react'
import { questionApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import {
  Search, ChevronLeft, ChevronRight, CheckCircle, XCircle,
  MessageSquare, Clock, User,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning text-white',
  ai_review: 'bg-[hsl(263,70%,50%)] text-white',
  human_review: 'bg-[hsl(330,81%,60%)] text-white',
  approved: 'bg-success text-white',
  rejected: 'bg-destructive text-white',
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
              className="pl-9"
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background dark:bg-card px-3 text-sm text-foreground"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="ai_review">AI Review</option>
            <option value="human_review">Human Review</option>
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
            <Card key={q.id} className="overflow-hidden">
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
                  {canModerate && q.status === 'pending' && (
                    <div className="flex flex-col gap-2 shrink-0">
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
    </div>
  )
}