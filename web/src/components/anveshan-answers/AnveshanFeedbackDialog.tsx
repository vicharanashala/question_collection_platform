import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Send, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MicButton } from '@/components/MicButton'
import { feedbackApi, getErrorMessage } from '@/api/client'
import { MAX_FEEDBACK_COMMENT_LENGTH } from '@/constants/public'
import { cn } from '@/lib/utils'
import { FieldError } from './FieldError'

const STAR_VALUES = [1, 2, 3, 4, 5] as const
const DEFAULT_RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
}

interface AnveshanFeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after feedback is saved (or the server says it already was). */
  onSubmitted: () => void
}

// Asks Anveshan users who reached 100% to rate the app and share a comment by typing or speaking.
export function AnveshanFeedbackDialog({ open, onOpenChange, onSubmitted }: AnveshanFeedbackDialogProps) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [usedVoice, setUsedVoice] = useState(false)
  const [ratingError, setRatingError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const shownRating = hovered || rating
  const ratingLabel = (value: number) => t(`anveshanFeedback.rating${value}`, DEFAULT_RATING_LABELS[value])

  const chooseRating = (value: number) => {
    setRating(value)
    setRatingError('')
  }

  // Arrow keys move between stars, matching the radio group pattern.
  const handleStarKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      chooseRating(Math.min(5, (rating || 0) + 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      chooseRating(Math.max(1, (rating || 2) - 1))
    }
  }

  // Appends dictated text to whatever the user has already typed.
  const appendTranscript = (text: string) => {
    const spoken = text.trim()
    if (!spoken) return
    setUsedVoice(true)
    setComment((current) => (current.trim() ? `${current.trimEnd()} ${spoken}` : spoken).slice(0, MAX_FEEDBACK_COMMENT_LENGTH))
  }

  // Validates the rating, then saves the feedback once.
  const submit = async () => {
    if (!rating) {
      setRatingError(t('anveshanFeedback.ratingRequired', 'Please choose a star rating.'))
      return
    }
    if (submitting) return
    setSubmitting(true)
    try {
      await feedbackApi.submitAnveshanFeedback({
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
        inputMethod: usedVoice ? 'voice' : 'text',
      })
      setDone(true)
      onSubmitted()
    } catch (err) {
      // Already submitted (e.g. from another tab) counts as done for the user.
      if ((err as { status?: number })?.status === 409) {
        setDone(true)
        onSubmitted()
      } else {
        toast.error(getErrorMessage(err, t('anveshanFeedback.submitFailed', 'Could not send your feedback. Please try again.')))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-md sm:p-6">
        {done ? (
          <div className="flex flex-col items-center py-4 text-center" role="status">
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40"
            >
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            </motion.span>
            <DialogTitle className="mt-4 text-center">{t('anveshanFeedback.thanksTitle', 'Thank you for your feedback!')}</DialogTitle>
            <DialogDescription className="mt-1 text-center">
              {t('anveshanFeedback.thanksBody', 'Your thoughts help us make AnnaDatha better for everyone.')}
            </DialogDescription>
            <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>
              {t('common.close', 'Close')}
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle>{t('anveshanFeedback.title', 'How was your experience?')}</DialogTitle>
              <DialogDescription>
                {t(
                  'anveshanFeedback.intro',
                  'Congratulations on reaching 100%! Please rate AnnaDatha and tell us what worked well or what we can improve. You can type or use the microphone.',
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-5">
              <div>
                <p id="feedback-rating-label" className="text-sm font-medium text-text">
                  {t('anveshanFeedback.ratingLabel', 'Your rating')} *
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby="feedback-rating-label"
                  aria-describedby={ratingError ? 'feedback-rating-error' : undefined}
                  onKeyDown={handleStarKeys}
                  onMouseLeave={() => setHovered(0)}
                  className="mt-2 flex items-center gap-1"
                >
                  {STAR_VALUES.map((value) => {
                    const filled = value <= shownRating
                    return (
                      <motion.button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={rating === value}
                        aria-label={`${value} ${value === 1 ? 'star' : 'stars'}, ${ratingLabel(value)}`}
                        tabIndex={rating === value || (!rating && value === 1) ? 0 : -1}
                        onClick={() => chooseRating(value)}
                        onMouseEnter={() => setHovered(value)}
                        whileTap={{ scale: 0.85 }}
                        whileHover={{ scale: 1.12 }}
                        disabled={submitting}
                        className="rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <Star
                          className={cn(
                            'h-8 w-8 transition-colors sm:h-9 sm:w-9',
                            filled ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-border',
                          )}
                          aria-hidden="true"
                        />
                      </motion.button>
                    )
                  })}
                  <span className="ml-2 min-w-[5rem] text-sm font-medium text-text-secondary" aria-hidden="true">
                    {shownRating ? ratingLabel(shownRating) : ''}
                  </span>
                </div>
                <FieldError id="feedback-rating-error" message={ratingError} />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="feedback-comment" className="text-sm font-medium">
                    {t('anveshanFeedback.commentLabel', 'Tell us more (optional)')}
                  </Label>
                  <span className="text-[11px] tabular-nums text-text-tertiary">
                    {comment.length}/{MAX_FEEDBACK_COMMENT_LENGTH}
                  </span>
                </div>
                <div className="mt-1.5 flex items-start gap-2">
                  <Textarea
                    id="feedback-comment"
                    value={comment}
                    maxLength={MAX_FEEDBACK_COMMENT_LENGTH}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={submitting}
                    placeholder={t('anveshanFeedback.commentPlaceholder', 'Type here, or tap the microphone and speak…')}
                    className="min-h-[110px] flex-1 resize-y"
                  />
                  <MicButton onTranscribed={(text) => appendTranscript(text)} disabled={submitting} />
                </div>
                <p className="mt-1.5 text-xs text-text-tertiary">
                  {t('anveshanFeedback.micHint', 'Speak in any language; your words will appear in the box so you can check them.')}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                {t('anveshanFeedback.later', 'Maybe later')}
              </Button>
              <Button onClick={() => void submit()} disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                {submitting ? t('anveshanFeedback.sending', 'Sending…') : t('anveshanFeedback.submit', 'Send feedback')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
