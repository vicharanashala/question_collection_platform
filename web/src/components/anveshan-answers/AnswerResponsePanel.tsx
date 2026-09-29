import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, FileText, Loader2, Lock, RotateCcw, Send, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SourceList, SourceUrlManager } from './SourceUrlManager'
import { MAX_ANVESHAN_ANSWER_LENGTH, MAX_ANVESHAN_REMARKS_LENGTH, MIN_ANVESHAN_ANSWER_LENGTH } from '@/constants/public'
import { cn } from '@/lib/utils'
import { FieldError } from './FieldError'
import type { AnveshanAnswerQuestion, AnveshanAnswerSource } from '@/types'

export interface AnswerDraft {
  answer: string
  remarks: string
  sources: AnveshanAnswerSource[]
}

export const EMPTY_DRAFT: AnswerDraft = { answer: '', remarks: '', sources: [] }

interface AnswerResponsePanelProps {
  question: AnveshanAnswerQuestion
  draft: AnswerDraft
  onDraftChange: (draft: AnswerDraft) => void
  onSubmit: (draft: AnswerDraft) => Promise<void>
  isSubmitting: boolean
  /** Required answer count once it has been reached; unanswered questions are then locked. */
  answerLimit?: number | null
}

// Right panel: shows the selected question and the answer form, the submitted answer, or a locked notice.
export function AnswerResponsePanel({ question, draft, onDraftChange, onSubmit, isSubmitting, answerLimit = null }: AnswerResponsePanelProps) {
  const { t } = useTranslation()

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 border-b border-border-subtle px-4 py-3">
        <span className="rounded-lg bg-primary/10 p-2">
          <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
        </span>
        <CardTitle className="text-base sm:text-lg">{t('anveshanAnswers.responseTitle', 'Response')}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5 p-4">
        <div>
          <p className="text-sm font-medium text-text-secondary">{t('anveshanAnswers.currentQuery', 'Current Query:')}</p>
          <p className="mt-1 break-words rounded-md border border-border-subtle p-3 text-sm text-text">{question.questionText}</p>
        </div>

        {question.answer ? (
          <SubmittedAnswer question={question} />
        ) : answerLimit !== null ? (
          <AnswerLimitNotice requiredAnswers={answerLimit} />
        ) : (
          <AnswerForm draft={draft} onDraftChange={onDraftChange} onSubmit={onSubmit} isSubmitting={isSubmitting} />
        )}
      </CardContent>
    </Card>
  )
}

// Explains that no more answers are accepted because the required number has already been submitted.
function AnswerLimitNotice({ requiredAnswers }: { requiredAnswers: number }) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-subtle bg-surface-variant/40 px-6 py-10 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
        <Lock className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
      </span>
      <p className="text-base font-semibold text-text">
        {t('anveshanAnswers.limitReachedTitle', {
          count: requiredAnswers,
          defaultValue: "You've submitted all {{count}} required answers",
        })}
      </p>
      <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
        {t('anveshanAnswers.limitReachedDescription', {
          count: requiredAnswers,
          defaultValue:
            'Only {{count}} answers are needed for your Anveshan milestone, so this question cannot be answered. You can still review the answers you submitted.',
        })}
      </p>
    </div>
  )
}

// Read-only view of an answer the user already submitted.
function SubmittedAnswer({ question }: { question: AnveshanAnswerQuestion }) {
  const { t } = useTranslation()
  const answer = question.answer
  if (!answer) return null

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {t('anveshanAnswers.alreadyAnswered', 'You have answered this question. Thank you!')}
      </p>
      <div>
        <p className="text-sm font-medium text-text">{t('anveshanAnswers.yourAnswer', 'Your Answer')}</p>
        <p className="mt-1 whitespace-pre-wrap break-words rounded-md border border-border-subtle bg-surface-variant p-3 text-sm text-text">
          {answer.answer}
        </p>
      </div>
      {answer.remarks && (
        <div>
          <p className="text-sm font-medium text-text">{t('anveshanAnswers.remarks', 'Remarks')}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-secondary">{answer.remarks}</p>
        </div>
      )}
      <div>
        <p className="mb-2 text-sm font-medium text-text">{t('anveshanAnswers.sourceReferences', 'Source References')}</p>
        <SourceList sources={answer.sources} />
      </div>
    </div>
  )
}

interface AnswerFormProps {
  draft: AnswerDraft
  onDraftChange: (draft: AnswerDraft) => void
  onSubmit: (draft: AnswerDraft) => Promise<void>
  isSubmitting: boolean
}

// Draft response, remarks and sources, with the same checks the expert review screen applies before submitting.
interface DraftErrors {
  answer?: string
  sources?: string
}

type Translate = ReturnType<typeof useTranslation>['t']

// Checks the draft against the same rules the server enforces and returns a message per invalid field.
function validateDraft(draft: AnswerDraft, t: Translate): DraftErrors {
  const errors: DraftErrors = {}
  const answerLength = draft.answer.trim().length
  if (answerLength === 0) {
    errors.answer = t('anveshanAnswers.errors.answerRequired', 'Please enter your answer.')
  } else if (answerLength < MIN_ANVESHAN_ANSWER_LENGTH) {
    errors.answer = t('anveshanAnswers.errors.answerTooShort', {
      min: MIN_ANVESHAN_ANSWER_LENGTH,
      count: answerLength,
      defaultValue: 'Your answer must be at least {{min}} characters. It is {{count}} characters now.',
    })
  }
  if (draft.sources.length === 0) {
    errors.sources = t(
      'anveshanAnswers.errors.sourceRequired',
      'Add at least one source. Fill in the source details above and press + to add it.',
    )
  }
  return errors
}

// Draft response, remarks and sources. Validation runs when Submit is pressed, then live as the user fixes errors.
function AnswerForm({ draft, onDraftChange, onSubmit, isSubmitting }: AnswerFormProps) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const answerRef = useRef<HTMLTextAreaElement>(null)
  const sourcesRef = useRef<HTMLDivElement>(null)
  const update = (patch: Partial<AnswerDraft>) => onDraftChange({ ...draft, ...patch })
  const errors = submitAttempted ? validateDraft(draft, t) : {}
  const answerLength = draft.answer.trim().length

  // Validates on click; focuses the first invalid field, otherwise asks for confirmation.
  const requestSubmit = () => {
    setSubmitAttempted(true)
    const found = validateDraft(draft, t)
    if (found.answer) {
      answerRef.current?.focus()
      return
    }
    if (found.sources) {
      sourcesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setConfirmOpen(true)
  }

  const confirmSubmit = async () => {
    await onSubmit(draft)
    setConfirmOpen(false)
  }

  const resetDraft = () => {
    setSubmitAttempted(false)
    onDraftChange(EMPTY_DRAFT)
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="anveshan-answer" className="text-sm font-medium">
              {t('anveshanAnswers.draftResponse', 'Draft Response:')} *
            </Label>
            <span
              id="anveshan-answer-count"
              className={cn(
                'text-[11px] tabular-nums',
                answerLength >= MIN_ANVESHAN_ANSWER_LENGTH ? 'text-emerald-700 dark:text-emerald-400' : 'text-text-tertiary',
              )}
            >
              {t('anveshanAnswers.answerCount', {
                count: answerLength,
                min: MIN_ANVESHAN_ANSWER_LENGTH,
                max: MAX_ANVESHAN_ANSWER_LENGTH,
                defaultValue: '{{count}}/{{max}} (min {{min}})',
              })}
            </span>
          </div>
          <Textarea
            ref={answerRef}
            id="anveshan-answer"
            placeholder={t('anveshanAnswers.answerPlaceholder', {
              min: MIN_ANVESHAN_ANSWER_LENGTH,
              defaultValue: 'Enter your answer here (at least {{min}} characters)...',
            })}
            value={draft.answer}
            maxLength={MAX_ANVESHAN_ANSWER_LENGTH}
            onChange={(e) => update({ answer: e.target.value })}
            disabled={isSubmitting}
            aria-invalid={!!errors.answer}
            aria-describedby={errors.answer ? 'anveshan-answer-error anveshan-answer-count' : 'anveshan-answer-count'}
            className={cn(
              'mt-1 min-h-[180px] resize-y md:min-h-[210px]',
              errors.answer && 'border-destructive focus-visible:ring-destructive',
            )}
          />
          <FieldError id="anveshan-answer-error" message={errors.answer} />
        </div>

        <div>
          <Label htmlFor="anveshan-remarks" className="text-sm font-medium">
            {t('anveshanAnswers.remarks', 'Remarks')}
          </Label>
          <Textarea
            id="anveshan-remarks"
            placeholder={t('anveshanAnswers.remarksPlaceholder', 'Enter remarks...')}
            value={draft.remarks}
            maxLength={MAX_ANVESHAN_REMARKS_LENGTH}
            onChange={(e) => update({ remarks: e.target.value })}
            disabled={isSubmitting}
            className="mt-1 min-h-[80px] resize-y"
          />
        </div>

        <div
          ref={sourcesRef}
          className={cn(
            'rounded-xl border bg-surface p-4 shadow-xs sm:p-6',
            errors.sources ? 'border-destructive' : 'border-border-subtle',
          )}
        >
          <SourceUrlManager
            sources={draft.sources}
            onSourcesChange={(sources) => update({ sources })}
            disabled={isSubmitting}
            describedBy={errors.sources ? 'anveshan-sources-error' : undefined}
          />
          <FieldError id="anveshan-sources-error" message={errors.sources} />
          {draft.sources.length > 0 && (
            <p className="mt-4 border-t border-border-subtle pt-4 text-sm text-text-secondary">
              {t('anveshanAnswers.sourcesAdded', { count: draft.sources.length, defaultValue: '{{count}} source(s) added' })}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3 pt-2">
        <Button onClick={requestSubmit} disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isSubmitting ? t('anveshanAnswers.submitting', 'Submitting…') : t('common.submit', 'Submit')}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={resetDraft}
          disabled={isSubmitting}
          aria-label={t('anveshanAnswers.resetAnswer', 'Reset answer')}
          title={t('anveshanAnswers.resetAnswer', 'Reset answer')}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !isSubmitting && setConfirmOpen(open)}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="space-y-3 px-6 pb-4 pt-6 text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Send className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
            <DialogTitle className="text-lg">{t('anveshanAnswers.confirmTitle', 'Submit your response?')}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {t('anveshanAnswers.confirmLead', 'Please cross-check your answer and sources carefully before submitting.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-6 pb-5">
            {/* What is about to be submitted, so the user can spot a missing piece before confirming. */}
            <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle text-sm">
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-text-secondary">{t('anveshanAnswers.confirmAnswerLength', 'Answer length')}</span>
                <span className="font-semibold tabular-nums text-text">
                  {t('anveshanAnswers.characters', { count: answerLength, defaultValue: '{{count}} characters' })}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-text-secondary">{t('anveshanAnswers.confirmSources', 'Sources')}</span>
                <span className="font-semibold tabular-nums text-text">{draft.sources.length}</span>
              </li>
              <li className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-text-secondary">{t('anveshanAnswers.remarks', 'Remarks')}</span>
                <span className="font-semibold text-text">
                  {draft.remarks.trim() ? t('common.added', 'Added') : t('common.none', 'None')}
                </span>
              </li>
            </ul>

            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t(
                'anveshanAnswers.confirmWarning',
                'The quality of your answer will be carefully reviewed during evaluation, and you cannot edit it after submitting.',
              )}
            </p>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 border-t border-border-subtle bg-surface-variant/40 px-6 py-4 sm:flex-row sm:justify-end sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>
              {t('anveshanAnswers.keepEditing', 'Keep editing')}
            </Button>
            <Button onClick={confirmSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {isSubmitting ? t('anveshanAnswers.submitting', 'Submitting…') : t('anveshanAnswers.confirmSubmit', 'Submit response')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
