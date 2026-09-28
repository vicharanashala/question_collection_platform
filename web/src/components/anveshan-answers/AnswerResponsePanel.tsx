import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CheckCircle2, FileText, Loader2, RotateCcw, Send } from 'lucide-react'
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
import { MAX_ANVESHAN_ANSWER_LENGTH, MAX_ANVESHAN_REMARKS_LENGTH } from '@/constants/public'
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
}

// Right panel: shows the selected question and either the answer form or the submitted answer.
export function AnswerResponsePanel({ question, draft, onDraftChange, onSubmit, isSubmitting }: AnswerResponsePanelProps) {
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
        ) : (
          <AnswerForm draft={draft} onDraftChange={onDraftChange} onSubmit={onSubmit} isSubmitting={isSubmitting} />
        )}
      </CardContent>
    </Card>
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
function AnswerForm({ draft, onDraftChange, onSubmit, isSubmitting }: AnswerFormProps) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const update = (patch: Partial<AnswerDraft>) => onDraftChange({ ...draft, ...patch })

  // Validates the draft, then asks for confirmation before submitting.
  const requestSubmit = () => {
    if (!draft.answer.trim()) {
      toast.error(t('anveshanAnswers.errors.answerRequired', 'Please enter your answer.'))
      return
    }
    if (draft.sources.length === 0) {
      toast.error(t('anveshanAnswers.errors.sourceRequired', 'At least one source is required!'))
      return
    }
    setConfirmOpen(true)
  }

  const confirmSubmit = async () => {
    await onSubmit(draft)
    setConfirmOpen(false)
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="anveshan-answer" className="text-sm font-medium">
              {t('anveshanAnswers.draftResponse', 'Draft Response:')} *
            </Label>
            <span className="text-[11px] tabular-nums text-text-tertiary" aria-live="polite">
              {draft.answer.length}/{MAX_ANVESHAN_ANSWER_LENGTH}
            </span>
          </div>
          <Textarea
            id="anveshan-answer"
            placeholder={t('anveshanAnswers.answerPlaceholder', 'Enter your answer here...')}
            value={draft.answer}
            maxLength={MAX_ANVESHAN_ANSWER_LENGTH}
            onChange={(e) => update({ answer: e.target.value })}
            disabled={isSubmitting}
            className="mt-1 min-h-[180px] resize-y md:min-h-[210px]"
          />
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

        <div className="rounded-xl border border-border-subtle bg-surface p-4 shadow-xs sm:p-6">
          <SourceUrlManager
            sources={draft.sources}
            onSourcesChange={(sources) => update({ sources })}
            disabled={isSubmitting}
          />
          {draft.sources.length > 0 && (
            <p className="mt-4 border-t border-border-subtle pt-4 text-sm text-text-secondary">
              {t('anveshanAnswers.sourcesAdded', { count: draft.sources.length, defaultValue: '{{count}} source(s) added' })}
            </p>
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3 pt-2">
        <Button onClick={requestSubmit} disabled={!draft.answer.trim() || isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {isSubmitting ? t('anveshanAnswers.submitting', 'Submitting…') : t('common.submit', 'Submit')}
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={() => onDraftChange(EMPTY_DRAFT)}
          disabled={isSubmitting}
          aria-label={t('anveshanAnswers.resetAnswer', 'Reset answer')}
          title={t('anveshanAnswers.resetAnswer', 'Reset answer')}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !isSubmitting && setConfirmOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('anveshanAnswers.confirmTitle', 'Submit Response')}</DialogTitle>
            <DialogDescription>
              {t(
                'anveshanAnswers.confirmDescription',
                'Please cross-check your answer and sources carefully. The quality of your answer will be carefully reviewed during evaluation, and you cannot edit it after submitting.',
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSubmitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={confirmSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('anveshanAnswers.confirmSubmit', 'Submit Response')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
