import { useTranslation } from 'react-i18next'
import { Search, MessageSquareQuote, Home } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export interface DuplicateInfo {
  matchedQuestion: string
  matchedAnswer: string | null
  similarityScore: number | null
  matchedUserName: string | null
}

interface DuplicateFoundDialogProps {
  /** The matched question, or null when no duplicate was found */
  duplicate: DuplicateInfo | null
  onOpenChange: (open: boolean) => void
  /** Dismiss and return to the question form */
  onTryAnother: () => void
  /** Dismiss and navigate away */
  onBackHome: () => void
}

/**
 * Shown when the question already exists in the knowledge base. Displays the
 * matched question and its expert answer so the user gets their answer straight
 * away instead of waiting for a review.
 */
export function DuplicateFoundDialog({ duplicate, onOpenChange, onTryAnother, onBackHome }: DuplicateFoundDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={duplicate !== null} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-amber-50 to-white px-6 pt-6 pb-5 text-center dark:from-amber-950/40 dark:to-surface">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
            <Search className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground sm:text-xl">
            {t('question.duplicateFoundTitle')}
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            {t('question.duplicateFoundMessage')}
          </DialogDescription>
        </div>

        <div className="max-h-[45vh] overflow-y-auto px-6 py-5">
          <div className="rounded-lg border border-border-subtle bg-surface-variant/50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {t('question.yourQuestion')}
            </p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-foreground">
              {duplicate?.matchedQuestion}
            </p>

            {duplicate?.matchedAnswer && (
              <div className="mt-4 border-t border-border-subtle pt-3">
                <div className="flex items-center gap-1.5">
                  <MessageSquareQuote className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    {t('question.duplicate.expertAnswer')}
                  </p>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {duplicate.matchedAnswer}
                </p>
              </div>
            )}

            {duplicate?.matchedUserName && (
              <p className="mt-3 text-xs text-text-tertiary">
                {t('question.duplicate.answeredBy', { name: duplicate.matchedUserName })}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border-subtle px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onTryAnother} className="justify-center">
            {t('question.tryAnotherQuestion', 'Ask a different question')}
          </Button>
          <Button onClick={onBackHome} className="justify-center gap-2">
            <Home className="h-4 w-4" />
            {t('question.duplicate.backHome')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
