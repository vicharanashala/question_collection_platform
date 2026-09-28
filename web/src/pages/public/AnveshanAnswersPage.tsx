import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, PenLine, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage, questionApi } from '@/api/client'
import { AnswerQuestionList } from '@/components/anveshan-answers/AnswerQuestionList'
import { SubmissionCriteriaGate } from '@/components/anveshan-answers/SubmissionCriteriaGate'
import { AnswerResponsePanel, EMPTY_DRAFT, type AnswerDraft } from '@/components/anveshan-answers/AnswerResponsePanel'
import type { AnveshanAnswerQuestionsResponse } from '@/types'

type LoadState = 'loading' | 'ready' | 'error'

// Picks the first unanswered question, falling back to the first question.
function pickDefaultQuestion(data: AnveshanAnswerQuestionsResponse): string | null {
  return (data.items.find((q) => !q.answer) ?? data.items[0])?.id ?? null
}

// Final Anveshan milestone step: users answer their own submitted questions with sources.
export function AnveshanAnswersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState<AnveshanAnswerQuestionsResponse | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, AnswerDraft>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const responseRef = useRef<HTMLDivElement>(null)

  // Fetches the eligible questions; keeps the current selection when it is still in the list.
  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoadState('loading')
    else setIsRefreshing(true)
    try {
      const result = await questionApi.getMyAnveshanAnswerQuestions()
      setData(result)
      setSelectedId((current) =>
        current && result.items.some((q) => q.id === current) ? current : pickDefaultQuestion(result),
      )
      setLoadState('ready')
    } catch (err) {
      if (mode === 'initial') setLoadState('error')
      else toast.error(getErrorMessage(err, t('anveshanAnswers.errors.loadFailed', 'Could not load your questions.')))
    } finally {
      setIsRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load('initial')
  }, [load])

  // Selects a question and, on small screens, brings the response panel into view.
  const selectQuestion = (id: string) => {
    setSelectedId(id)
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => responseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  // Submits the answer, updates the list in place and moves on to the next unanswered question.
  const submitAnswer = async (draft: AnswerDraft) => {
    if (!data || !selectedId || isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await questionApi.submitAnveshanAnswer(selectedId, {
        answer: draft.answer.trim(),
        sources: draft.sources,
        ...(draft.remarks.trim() ? { remarks: draft.remarks.trim() } : {}),
      })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[selectedId]
        return next
      })
      const items = data.items.map((q) => (q.id === result.question.id ? result.question : q))
      const nextData = { ...data, items, answeredCount: result.answeredCount, completed: result.completed }
      setData(nextData)
      setSelectedId(pickDefaultQuestion(nextData))
      toast.success(
        result.completed
          ? t('anveshanAnswers.completedToast', '🎉 Milestone complete! You have reached 100%.')
          : t('anveshanAnswers.submittedToast', 'Your response has been submitted. Thank you!'),
      )
    } catch (err) {
      toast.error(getErrorMessage(err, t('anveshanAnswers.errors.submitFailed', 'Could not submit your answer. Please try again.')))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadState === 'loading') return <PageSkeleton />

  if (loadState === 'error' || !data) {
    return (
      <StatusCard
        icon={<AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />}
        title={t('anveshanAnswers.errors.loadFailed', 'Could not load your questions.')}
        action={<Button onClick={() => void load('initial')}>{t('common.retry', 'Try again')}</Button>}
      />
    )
  }

  if (!data.unlocked) {
    return <SubmissionCriteriaGate requirements={data.requirements} progress={data.progress} />
  }

  const selectedQuestion = data.items.find((q) => q.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        answered={data.answeredCount}
        required={data.requiredAnswers}
        completed={data.completed}
        onBack={() => navigate(-1)}
      />

      {data.items.length === 0 ? (
        <StatusCard
          icon={<PenLine className="h-6 w-6 text-text-tertiary" aria-hidden="true" />}
          title={t('anveshanAnswers.emptyTitle', 'No questions to answer yet')}
          description={t('anveshanAnswers.emptyDescription', 'Questions you submit will appear here.')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,_1fr)_minmax(400px,_1.2fr)] lg:gap-6">
          <AnswerQuestionList
            questions={data.items}
            selectedId={selectedId}
            onSelect={selectQuestion}
            onRefresh={() => void load('refresh')}
            isRefreshing={isRefreshing}
          />
          <div ref={responseRef} className="scroll-mt-4">
            {selectedQuestion ? (
              <AnswerResponsePanel
                key={selectedQuestion.id}
                question={selectedQuestion}
                draft={drafts[selectedQuestion.id] ?? EMPTY_DRAFT}
                onDraftChange={(draft) => setDrafts((prev) => ({ ...prev, [selectedQuestion.id]: draft }))}
                onSubmit={submitAnswer}
                isSubmitting={isSubmitting}
              />
            ) : (
              <StatusCard title={t('anveshanAnswers.selectPrompt', 'Select a question to write your answer.')} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface PageHeaderProps {
  answered: number
  required: number
  completed: boolean
  onBack: () => void
}

// Title, encouragement and answer progress for the page.
function PageHeader({ answered, required, completed, onBack }: PageHeaderProps) {
  const { t } = useTranslation()
  const percent = required === 0 ? 100 : Math.min(100, Math.round((answered / required) * 100))

  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1.5">
        <ArrowLeft className="h-4 w-4" />
        {t('common.back', 'Back')}
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground sm:text-xl">
            {t('anveshanAnswers.title', 'Answer Your Questions')}
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs text-text-secondary sm:text-sm">
            {t('anveshanAnswers.subtitle', {
              count: required,
              defaultValue:
                'You know these questions best. Answer any {{count}} of them with at least one trusted source to complete your Anveshan milestone.',
            })}
          </p>
        </div>

        <div className="w-full sm:w-56" aria-label={`${answered} of ${required}`}>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-text-secondary">{t('anveshanAnswers.progressLabel', 'Answers')}</span>
            <span className={completed ? 'text-emerald-700 dark:text-emerald-400' : 'text-primary'}>
              {answered}/{required}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border-subtle" aria-hidden="true">
            <div
              className={`h-full rounded-full transition-all duration-500 ${completed ? 'bg-emerald-500' : 'bg-primary'}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      {completed && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('anveshanAnswers.completedBanner', 'Milestone complete! You have reached 100%. You can keep answering more if you like.')}
        </div>
      )}
    </div>
  )
}

interface StatusCardProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

// Centered message card used for loading errors, locked, empty and no-selection states.
function StatusCard({ icon, title, description, action }: StatusCardProps) {
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-10 text-center">
      {icon && <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-variant">{icon}</div>}
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {description && <p className="text-sm text-text-secondary">{description}</p>}
      {action}
    </Card>
  )
}

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[480px] w-full rounded-xl" />
      </div>
    </div>
  )
}
