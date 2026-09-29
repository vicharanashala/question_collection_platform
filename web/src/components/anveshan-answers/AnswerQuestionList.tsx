import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock, Info, Lock, MapPin, RefreshCw, Sprout } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { InfoTip } from './InfoTip'
import { useRelativeTime } from '@/components/submissions/useRelativeTime'
import type { AnveshanAnswerQuestion } from '@/types'

interface AnswerQuestionListProps {
  questions: AnveshanAnswerQuestion[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRefresh: () => void
  isRefreshing: boolean
  /** True once the required answers are submitted; unanswered questions are shown as locked. */
  answeringClosed?: boolean
}

// Left panel listing the user's eligible questions as a single-select list.
export function AnswerQuestionList({ questions, selectedId, onSelect, onRefresh, isRefreshing, answeringClosed = false }: AnswerQuestionListProps) {
  const { t } = useTranslation()

  return (
    <Card className="flex max-h-[80vh] flex-col lg:absolute lg:inset-0 lg:max-h-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm md:text-base">{t('anveshanAnswers.listTitle', 'Your Questions')}</CardTitle>
          <InfoTip
            label={t('anveshanAnswers.aboutList', 'About this list')}
            className="p-0.5 text-text-tertiary hover:text-text"
            content={t('anveshanAnswers.listHint', 'These are the questions you submitted. Pick any of them to answer.')}
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </InfoTip>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-8 w-8"
          aria-label={t('common.refresh', 'Refresh')}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
        </Button>
      </CardHeader>

      <div
        role="radiogroup"
        aria-label={t('anveshanAnswers.listTitle', 'Your Questions')}
        className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4"
      >
        {questions.map((question, index) => (
          <QuestionItem
            key={question.id}
            question={question}
            index={index}
            selected={question.id === selectedId}
            onSelect={onSelect}
            locked={answeringClosed && !question.answer}
          />
        ))}
      </div>
    </Card>
  )
}

interface QuestionItemProps {
  question: AnveshanAnswerQuestion
  index: number
  selected: boolean
  onSelect: (id: string) => void
  locked: boolean
}

// One selectable question card; answered questions carry a check badge, locked ones a muted "not required" badge.
function QuestionItem({ question, index, selected, onSelect, locked }: QuestionItemProps) {
  const { t } = useTranslation()
  const relativeTime = useRelativeTime()
  const answered = !!question.answer

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(question.id)}
      className={cn(
        'group relative w-full overflow-hidden rounded-xl border border-l-4 p-4 text-left transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
        answered ? 'border-l-emerald-500' : locked ? 'border-l-border-subtle' : 'border-l-primary',
        selected
          ? answered
            ? 'border-emerald-500 bg-emerald-500/5 shadow-md ring-2 ring-emerald-500/20'
            : locked
              ? 'border-text-tertiary bg-surface-variant/60 shadow-sm'
              : 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
          : 'border-border-subtle bg-surface hover:bg-surface-variant/60 hover:shadow-sm',
        locked && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
            selected ? (answered ? 'border-emerald-500' : 'border-primary') : 'border-text-tertiary',
          )}
        >
          {selected && <span className={cn('h-2.5 w-2.5 rounded-full', answered ? 'bg-emerald-500' : 'bg-primary')} />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-text-tertiary">#{index + 1}</span>
            {answered ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {t('anveshanAnswers.answered', 'Answered')}
              </span>
            ) : locked ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-variant px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                <Lock className="h-3 w-3" aria-hidden="true" />
                {t('anveshanAnswers.notRequired', 'Not required')}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {t('anveshanAnswers.awaitingAnswer', 'Awaiting answer')}
              </span>
            )}
          </div>
          <p className="line-clamp-3 text-sm font-medium leading-relaxed text-text md:text-base">{question.questionText}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
            {question.cropType && (
              <span className="inline-flex items-center gap-1">
                <Sprout className="h-3 w-3" aria-hidden="true" />
                {question.cropType}
              </span>
            )}
            {question.district && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {question.district}, {question.state}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {relativeTime(question.submittedAt)}
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
