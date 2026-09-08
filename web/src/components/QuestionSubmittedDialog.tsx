import { useTranslation } from 'react-i18next'
import { CheckCircle2, Plus, ListChecks } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface QuestionSubmittedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Reset the form and stay on the page */
  onAskAnother: () => void
  /** Navigate to the user's submissions list */
  onViewSubmissions: () => void
  /** Daily submission counters, hidden when unknown */
  remainingToday?: number
  dailyLimit?: number
}

/** Confirmation shown after a question is accepted for review. */
export function QuestionSubmittedDialog({
  open,
  onOpenChange,
  onAskAnother,
  onViewSubmissions,
  remainingToday,
  dailyLimit,
}: QuestionSubmittedDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-emerald-50 to-white px-6 pt-6 pb-5 text-center dark:from-emerald-950/40 dark:to-surface">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground sm:text-xl">
            {t('question.submitted')}
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            {t('question.successBody')}
          </DialogDescription>
        </div>

        {remainingToday != null && dailyLimit != null && (
          <p className="px-6 pt-4 text-center text-xs text-text-tertiary">
            {t('question.dailyLeftToday', { remaining: remainingToday, total: dailyLimit })}
          </p>
        )}

        <div className="flex flex-col gap-2 px-6 pb-6 pt-4 sm:flex-row">
          <Button variant="outline" onClick={onAskAnother} className="flex-1 justify-center gap-2">
            <Plus className="h-4 w-4" />
            {t('question.submitAnother')}
          </Button>
          <Button onClick={onViewSubmissions} className="flex-1 justify-center gap-2">
            <ListChecks className="h-4 w-4" />
            {t('nav.submissions')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
