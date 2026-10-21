import { useMemo, useState } from 'react'
import { ChevronDown, MapPin, Search, Sprout } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn, formatDateTime } from '@/lib/utils'
import type { AnveshanUserQuestion } from '@/types'

function QuestionCard({ question }: { question: AnveshanUserQuestion }) {
  const [open, setOpen] = useState(false)
  const answer = question.answer

  return (
    <li className="space-y-3 p-4">
      <p className="text-sm font-medium text-foreground">{question.questionText}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
        {question.cropType && (
          <span className="inline-flex items-center gap-1"><Sprout className="h-3.5 w-3.5" aria-hidden="true" />{question.cropType}</span>
        )}
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {[question.district, question.state].filter(Boolean).join(', ') || '—'}
        </span>
        <span>Submitted {formatDateTime(question.submittedAt)}</span>
      </div>

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

interface QuestionFilters {
  search: string
  answeredOnly: boolean
}

// Search box and "Answered only" switch, shown in the tab bar row while the Questions tab is open.
export function AnveshanQuestionsToolbar({
  search,
  answeredOnly,
  onSearchChange,
  onAnsweredOnlyChange,
}: QuestionFilters & { onSearchChange: (value: string) => void; onAnsweredOnlyChange: (value: boolean) => void }) {
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
        <Input
          aria-label="Search questions"
          placeholder="Search questions or crops..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex h-10 shrink-0 items-center gap-2 rounded-md border border-border-subtle bg-surface px-3">
        <Switch id="answered-only" checked={answeredOnly} onCheckedChange={onAnsweredOnlyChange} className="h-5 w-9" aria-label="Show answered questions only" />
        <label htmlFor="answered-only" className="cursor-pointer whitespace-nowrap text-xs font-medium text-text-secondary">
          Answered only
        </label>
      </div>
    </div>
  )
}

// Questions the Anveshan user submitted, narrowed by the toolbar filters, with their answers.
export function AnveshanQuestionsTab({ questions, search, answeredOnly }: { questions: AnveshanUserQuestion[] } & QuestionFilters) {
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return questions.filter(
      (q) =>
        (!answeredOnly || q.answer) &&
        (!term || q.questionText.toLowerCase().includes(term) || q.cropType.toLowerCase().includes(term)),
    )
  }, [questions, search, answeredOnly])

  return (
    <Card className="overflow-hidden">
      {filtered.length === 0 ? (
        <p className="p-8 text-center text-sm text-text-secondary">No questions found</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {filtered.map((question) => <QuestionCard key={question.id} question={question} />)}
        </ul>
      )}
    </Card>
  )
}
