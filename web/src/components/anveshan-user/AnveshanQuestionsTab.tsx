import { useMemo, useState } from 'react'
import { ChevronDown, MapPin, Search, Sprout } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn, formatDateTime } from '@/lib/utils'
import type { AnveshanUserQuestion, QuestionStatus } from '@/types'

const STATUS_STYLE: Record<QuestionStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  held: { label: 'Held', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
  rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
  moved_to_final: { label: 'Published', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
}

// The review note that explains the question's current status, if there is one.
function statusReason(question: AnveshanUserQuestion): string | null {
  if (question.status === 'rejected') return question.rejectionReason
  if (question.status === 'held') return question.heldReason
  if (question.status === 'approved') return question.approvalReason
  return null
}

function QuestionCard({ question }: { question: AnveshanUserQuestion }) {
  const [open, setOpen] = useState(false)
  const status = STATUS_STYLE[question.status] ?? { label: question.status, cls: 'bg-muted text-muted-foreground' }
  const reason = statusReason(question)
  const answer = question.answer

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{question.questionText}</p>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', status.cls)}>{status.label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
        {question.cropType && (
          <span className="inline-flex items-center gap-1"><Sprout className="h-3.5 w-3.5" aria-hidden="true" />{question.cropType}</span>
        )}
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {[question.district, question.state].filter(Boolean).join(', ') || '—'}
        </span>
        <span>Submitted {formatDateTime(question.submittedAt)}</span>
        {question.reviewedAt && <span>Reviewed {formatDateTime(question.reviewedAt)}</span>}
      </div>
      {reason && <p className="rounded-md bg-surface-variant/60 px-3 py-2 text-xs text-text-secondary">Review note: {reason}</p>}

      {answer ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-300"
          >
            <span>
              Answered {formatDateTime(answer.answeredAt)}
              {answer.scorePercentage !== null && ` · Score ${Math.round(answer.scorePercentage)}%`}
            </span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </button>
          {open && (
            <div className="space-y-3 border-t border-emerald-200 px-3 py-3 text-sm dark:border-emerald-900/50">
              <p className="whitespace-pre-wrap text-foreground">{answer.answer}</p>
              {answer.sources.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Sources</p>
                  <ul className="space-y-1 text-xs text-text-secondary">
                    {answer.sources.map((source, index) => (
                      <li key={`${source.sourceName}-${index}`}>
                        <span className="font-medium text-foreground">{source.sourceName}</span>
                        {source.page ? ` (p. ${source.page})` : ''} · {source.source}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {answer.remarks && <p className="text-xs text-text-secondary">Remarks: {answer.remarks}</p>}
            </div>
          )}
        </div>
      ) : question.isAnswerSubmitted ? null : (
        <Badge variant="outline" className="text-[11px]">Not answered</Badge>
      )}
    </li>
  )
}

// Questions the Anveshan user submitted, searchable, with their answers.
export function AnveshanQuestionsTab({ questions }: { questions: AnveshanUserQuestion[] }) {
  const [search, setSearch] = useState('')
  const [answeredOnly, setAnsweredOnly] = useState(false)
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return questions.filter(
      (q) =>
        (!answeredOnly || q.answer) &&
        (!term || q.questionText.toLowerCase().includes(term) || q.cropType.toLowerCase().includes(term)),
    )
  }, [questions, search, answeredOnly])

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
          <Input aria-label="Search questions" placeholder="Search questions or crops..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input type="checkbox" checked={answeredOnly} onChange={(e) => setAnsweredOnly(e.target.checked)} />
          Answered only
        </label>
      </div>
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-secondary">No questions found</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {filtered.map((question) => <QuestionCard key={question.id} question={question} />)}
          </ul>
        )}
      </Card>
    </div>
  )
}
