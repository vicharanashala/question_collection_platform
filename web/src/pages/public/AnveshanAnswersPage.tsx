import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertCircle, ArrowLeft, BookOpenCheck, ExternalLink, Info, MonitorPlay, MonitorSmartphone, PenLine, ShieldCheck, Trophy } from 'lucide-react'
import { InfoTip } from '@/components/anveshan-answers/InfoTip'
import { ANVESHAN_ANSWERS_DESKTOP_QUERY, ANVESHAN_PLATFORM_URL } from '@/constants/public'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage, questionApi } from '@/api/client'
import { AnswerQuestionList } from '@/components/anveshan-answers/AnswerQuestionList'
import { SubmissionCriteriaGate } from '@/components/anveshan-answers/SubmissionCriteriaGate'
import { AnsweringGuideDialog } from '@/components/anveshan-answers/AnsweringGuideDialog'
import { useAuth } from '@/context/AuthContext'
import { AnswerResponsePanel, EMPTY_DRAFT, type AnswerDraft } from '@/components/anveshan-answers/AnswerResponsePanel'
import type { AnveshanAnswerQuestionsResponse } from '@/types'

type LoadState = 'loading' | 'ready' | 'error'

const guideSeenKey = (userId: string) => `anveshan_answer_guide_seen_${userId}`

// Storage can be unavailable (private mode, blocked site data); the guide then simply opens every visit.
function readGuideSeen(userId: string): boolean {
  try {
    return localStorage.getItem(guideSeenKey(userId)) === '1'
  } catch {
    return false
  }
}

function markGuideSeen(userId: string): void {
  try {
    localStorage.setItem(guideSeenKey(userId), '1')
  } catch {
    // Non-critical: the guide will show again next visit.
  }
}

// True once the user has submitted every required answer; remaining questions can no longer be answered.
function isAnswerLimitReached(data: AnveshanAnswerQuestionsResponse): boolean {
  return data.answeredCount >= data.requiredAnswers
}

// Picks the first unanswered question, or the first answered one once no more answers are allowed.
function pickDefaultQuestion(data: AnveshanAnswerQuestionsResponse): string | null {
  const preferred = isAnswerLimitReached(data) ? data.items.find((q) => q.answer) : data.items.find((q) => !q.answer)
  return (preferred ?? data.items[0])?.id ?? null
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
  const [guideOpen, setGuideOpen] = useState(false)
  const isDesktop = useMediaQuery(ANVESHAN_ANSWERS_DESKTOP_QUERY)
  const { user } = useAuth()
  const userId = user?.id

  // Shows the guide automatically on a user's first visit once answering is unlocked.
  useEffect(() => {
    if (!userId || !data?.unlocked || !isDesktop) return
    if (!readGuideSeen(userId)) setGuideOpen(true)
  }, [userId, data?.unlocked, isDesktop])

  const changeGuideOpen = (open: boolean) => {
    setGuideOpen(open)
    if (!open && userId) markGuideSeen(userId)
  }

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

  // Questions load only on desktop-sized screens; phones see the desktop-only notice instead.
  useEffect(() => {
    if (!isDesktop) return
    void load('initial')
  }, [load, isDesktop])


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
      // The answer that completes the milestone moves the user to the completion screen, which also asks for feedback.
      if (result.completed && !data.completed) navigate('/home', { replace: true })
      toast.success(
        result.completed
          ? t('anveshanAnswers.completedToast', '🎉 Congratulations! You have reached 100%. Check your completion on the Anveshan platform.')
          : t('anveshanAnswers.submittedToast', 'Your response has been submitted. Thank you!'),
      )
    } catch (err) {
      toast.error(getErrorMessage(err, t('anveshanAnswers.errors.submitFailed', 'Could not submit your answer. Please try again.')))
      // A 403 means the answer limit was reached elsewhere (for example another tab), so resync the list.
      if ((err as { status?: number }).status === 403) void load('refresh')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isDesktop) {
    return (
      <StatusCard
        icon={<MonitorSmartphone className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
        title={t('anveshanAnswers.desktopOnlyTitle', 'Please open this on a desktop or laptop')}
        description={t(
          'anveshanAnswers.desktopOnlyDescription',
          'Giving advice uses the full review layout, with your questions beside the answer form and sources, just like the Ajrasakha expert system. It is not available on mobile phones. Open AnnaDatha on a desktop or laptop to continue; your progress is saved.',
        )}
        action={
          <Button asChild variant="outline">
            <Link to="/home">{t('anveshanAnswers.backHome', 'Back to home')}</Link>
          </Button>
        }
      />
    )
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
  const answerLimitReached = isAnswerLimitReached(data)

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader
        answered={data.answeredCount}
        required={data.requiredAnswers}
        completed={data.completed}
        onBack={() => navigate(-1)}
        onOpenGuide={() => setGuideOpen(true)}
      />
      <AnsweringGuideDialog open={guideOpen} onOpenChange={changeGuideOpen} requiredAnswers={data.requiredAnswers} />
      {data.items.length === 0 ? (
        <StatusCard
          icon={<PenLine className="h-6 w-6 text-text-tertiary" aria-hidden="true" />}
          title={t('anveshanAnswers.emptyTitle', 'No questions to answer yet')}
          description={t('anveshanAnswers.emptyDescription', 'Questions you submit will appear here.')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,_1fr)_minmax(400px,_1.2fr)] lg:gap-6">
          {/* On large screens the list is positioned to fill this cell, so its height always matches the response panel. */}
          <div className="lg:relative">
            <AnswerQuestionList
              questions={data.items}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onRefresh={() => void load('refresh')}
              isRefreshing={isRefreshing}
              answeringClosed={answerLimitReached}
            />
          </div>
          <div className="lg:min-h-[calc(100vh-14rem)]">
            {selectedQuestion ? (
              <AnswerResponsePanel
                key={selectedQuestion.id}
                question={selectedQuestion}
                draft={drafts[selectedQuestion.id] ?? EMPTY_DRAFT}
                onDraftChange={(draft) => setDrafts((prev) => ({ ...prev, [selectedQuestion.id]: draft }))}
                onSubmit={submitAnswer}
                isSubmitting={isSubmitting}
                answerLimit={answerLimitReached ? data.requiredAnswers : null}
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
  onOpenGuide: () => void
}

// Title, encouragement and answer progress for the page.
function PageHeader({ answered, required, completed, onBack, onOpenGuide }: PageHeaderProps) {
  const { t } = useTranslation()
  const percent = required === 0 ? 100 : Math.min(100, Math.round((answered / required) * 100))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          {t('common.back', 'Back')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onOpenGuide} className="gap-1.5">
          <BookOpenCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          {t('anveshanGuide.open', 'Answering guide')}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-1.5">
            <h1 className="text-lg font-bold text-foreground sm:text-xl">
              {t('anveshanAnswers.titleAdvice', "Give advice for farmer's query")}
            </h1>
            <InfoTip
              label={t('anveshanAnswers.aboutPage', 'About this page')}
              className="p-1 text-text-tertiary hover:text-text"
              content={t('anveshanAnswers.subtitle', {
                count: required,
                defaultValue:
                  'You know these questions best. Answer any {{count}} of them with at least one trusted source to complete your Anveshan milestone.',
              })}
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </InfoTip>
          </div>

          {/* Short labels keep the header light; the full explanations live in their tooltips. */}
          <div className="flex flex-wrap items-center gap-2">
            <InfoTip
              className="gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-500/15 sm:text-xs dark:text-amber-400"
              content={t(
                'anveshanAnswers.qualityNotice',
                'The quality of every answer you submit will be carefully reviewed during evaluation, so make it accurate, clear and well sourced.',
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t('anveshanAnswers.qualityChip', 'Quality is evaluated')}
              <Info className="h-3 w-3 opacity-70" aria-hidden="true" />
            </InfoTip>
            <InfoTip
              className="gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/15 sm:text-xs"
              content={
                <>
                  <span className="block font-semibold">
                    {t('anveshanAnswers.simulationTitle', 'This is a simulation of the Ajrasakha review system')}
                  </span>
                  {t(
                    'anveshanAnswers.simulationBody',
                    'The layout, steps and checks here mirror the answer creation screen experts use on Ajrasakha. Take your time: every clear, well-sourced answer you write builds the skills that help farmers get advice they can trust. You are almost there!',
                  )}
                </>
              }
            >
              <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
              {t('anveshanAnswers.simulationChip', 'Ajrasakha simulation')}
              <Info className="h-3 w-3 opacity-70" aria-hidden="true" />
            </InfoTip>
          </div>
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
          className="flex flex-col gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 sm:flex-row sm:items-center dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {t(
                'anveshanAnswers.completedBanner100',
                '🎉 Congratulations! You have reached 100%. Kindly go to the Anveshan platform and check your completion there.',
              )}
            </span>
          </div>
          <Button asChild size="sm" className="shrink-0 gap-1.5 self-start bg-emerald-600 text-white hover:bg-emerald-700 sm:self-auto">
            <a href={ANVESHAN_PLATFORM_URL} target="_blank" rel="noopener noreferrer">
              {t('anveshan.goToAnveshan', 'Go to Anveshan')}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{t('common.opensInNewTab', '(opens in a new tab)')}</span>
            </a>
          </Button>
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
