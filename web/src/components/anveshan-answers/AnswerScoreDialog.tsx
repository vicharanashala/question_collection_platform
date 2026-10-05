import { useTranslation } from 'react-i18next'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AnswerScoreCard } from './AnswerScoreCard'
import type { AnveshanAnswerScore } from '@/types'

export interface ScoreDialogTarget {
  questionId: string
  initialScore: AnveshanAnswerScore | null
  /** True when this advisory completed the milestone, so closing moves on to the completion screen. */
  completesMilestone: boolean
}

interface AnswerScoreDialogProps {
  target: ScoreDialogTarget | null
  onScoreChange: (questionId: string, score: AnveshanAnswerScore) => void
  onClose: (target: ScoreDialogTarget) => void
}

// Shown right after an advisory is submitted, with its system score as soon as scoring finishes.
export function AnswerScoreDialog({ target, onScoreChange, onClose }: AnswerScoreDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && target && onClose(target)}>
      {target && (
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="space-y-3 px-6 pb-4 pt-6 text-left">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            </span>
            <DialogTitle className="text-lg">{t('anveshanAnswers.score.dialogTitle', 'Advisory submitted')}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {t('anveshanAnswers.score.dialogLead', 'Here is how the system scored your advisory.')}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-5">
            <AnswerScoreCard
              questionId={target.questionId}
              initialScore={target.initialScore}
              onScoreChange={(score) => onScoreChange(target.questionId, score)}
            />
          </div>

          <DialogFooter className="border-t border-border-subtle bg-surface-variant/40 px-6 py-4">
            <Button onClick={() => onClose(target)}>
              {target.completesMilestone
                ? t('anveshanAnswers.score.viewCompletion', 'View my completion')
                : t('anveshanAnswers.score.continue', 'Continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}
