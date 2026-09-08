import { useTranslation } from 'react-i18next'
import { AlertTriangle, Leaf, ShieldAlert, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { QuestionRejectionCategory } from '@/api/client'

interface QuestionRejectedDialogProps {
  /** The rejection category, or null when nothing was rejected */
  category: QuestionRejectionCategory | null
  /** The text the user tried to submit, echoed back so they can correct it */
  questionText: string
  onOpenChange: (open: boolean) => void
}

// Copy shown for each content-check category. The server's raw reason is
// English-only and embeds a truncated model fragment, so it is never shown.
const COPY: Record<
  QuestionRejectionCategory,
  { Icon: typeof AlertTriangle; titleKey: string; titleFallback: string; bodyKey: string; bodyFallback: string }
> = {
  ABUSIVE: {
    Icon: ShieldAlert,
    titleKey: 'question.rejectedAbusiveTitle',
    titleFallback: 'Please rephrase your question',
    bodyKey: 'question.rejectedAbusiveMessage',
    bodyFallback: 'Your question contains language we cannot accept. Please remove any offensive words and ask your farming question politely.',
  },
  NOT_AGRICULTURE: {
    Icon: Leaf,
    titleKey: 'question.rejectedNotAgriTitle',
    titleFallback: 'Not a farming question',
    bodyKey: 'question.rejectedNotAgriMessage',
    bodyFallback: 'We can only answer questions about farming — crops, livestock, soil, pests, weather and related topics. Please ask a farming question.',
  },
  OTHER: {
    Icon: AlertTriangle,
    titleKey: 'question.rejectedOtherTitle',
    titleFallback: 'Question could not be accepted',
    bodyKey: 'question.rejectedOtherMessage',
    bodyFallback: 'We could not accept this question. Please rewrite it and try again.',
  },
}

/**
 * Shown when the backend content check blocks a submission as abusive or
 * non-agricultural. Nothing was saved and no daily slot was used, so the only
 * action is to go back and edit the text.
 */
export function QuestionRejectedDialog({ category, questionText, onOpenChange }: QuestionRejectedDialogProps) {
  const { t } = useTranslation()
  const copy = category ? COPY[category] ?? COPY.OTHER : COPY.OTHER
  const { Icon } = copy

  return (
    <Dialog open={category !== null} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-rose-50 to-white px-6 pt-6 pb-5 text-center dark:from-rose-950/40 dark:to-surface">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50">
            <Icon className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground sm:text-xl">
            {t(copy.titleKey, copy.titleFallback)}
          </DialogTitle>
          <DialogDescription className="text-sm text-text-secondary">
            {t(copy.bodyKey, copy.bodyFallback)}
          </DialogDescription>
        </div>

        <div className="space-y-3 px-6 py-5">
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {t('question.rejectedNotCounted', 'This was not submitted and does not count against your daily limit.')}
          </p>

          {Boolean(questionText.trim()) && (
            <div className="rounded-lg border border-border-subtle bg-surface-variant/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
                {t('question.rejectedYourQuestion', 'Your question')}
              </p>
              <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {questionText.trim()}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <Button onClick={() => onOpenChange(false)} className="w-full justify-center gap-2">
            <Pencil className="h-4 w-4" />
            {t('question.rejectedEditQuestion', 'Edit My Question')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
