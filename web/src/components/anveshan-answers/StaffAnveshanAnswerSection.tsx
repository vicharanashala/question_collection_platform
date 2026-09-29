import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2, MessageSquareReply } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getErrorMessage, questionApi } from '@/api/client'
import { formatDate } from '@/lib/utils'
import type { AnveshanAnswer } from '@/types'
import { SourceList } from './SourceUrlManager'

type LoadState = 'loading' | 'ready' | 'error'

interface StaffAnveshanAnswerSectionProps {
  questionId: string
}

// Shows staff the answer (with sources) an Anveshan user submitted for their own question.
export function StaffAnveshanAnswerSection({ questionId }: StaffAnveshanAnswerSectionProps) {
  const [answer, setAnswer] = useState<AnveshanAnswer | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState('')

  // Fetches the answer for the open question; a missing answer is a normal empty state, not an error.
  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const result = await questionApi.getAnveshanAnswer(questionId)
      setAnswer(result.answer)
      setLoadState('ready')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the submitted answer.'))
      setLoadState('error')
    }
  }, [questionId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section aria-labelledby="anveshan-answer-heading" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id="anveshan-answer-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageSquareReply className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          Anveshan User&apos;s Answer
        </h3>
        {answer && (
          <span className="text-xs text-muted-foreground">Answered {formatDate(answer.answeredAt)}</span>
        )}
      </div>

      {loadState === 'loading' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading answer…
        </p>
      )}

      {loadState === 'error' && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-destructive" role="alert">
          <span className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            {error}
          </span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {loadState === 'ready' && !answer && (
        <p className="text-sm text-muted-foreground">The user has not answered this question yet.</p>
      )}

      {loadState === 'ready' && answer && (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap break-words rounded-md border border-border-subtle bg-surface p-3 text-sm text-foreground">
            {answer.answer}
          </p>
          {answer.remarks && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Remarks</p>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{answer.remarks}</p>
            </div>
          )}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Sources ({answer.sources.length})
            </p>
            <SourceList sources={answer.sources} />
          </div>
        </div>
      )}
    </section>
  )
}
