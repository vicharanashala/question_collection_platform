/**
 * Question Detail Modal — read-only dialog showing a single submission
 * belonging to the authenticated public user. Mirrors the field selection of
 * the admin `QuestionsPage` and the visual style of `PublicReportDetailPage`,
 * while filtering out admin-only fields (reviewer ID/name, per-status reviewer
 * controls, `TranslatableText`) so the user sees a clean, self-focused summary.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { questionApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  MessageSquareText, ImageIcon, Mic, MapPin, Wheat,
  CloudRain, Hash, Loader2, AlertCircle,
} from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import type { Question } from '@/types'

// ─── Status pill config (mirrors PublicQuestionsPage styling) ────────────────

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    approved: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    held: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    moved_to_final: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  }
  return map[s] ?? 'bg-muted text-muted-foreground'
}

function statusLabelKey(s: string): string {
  switch (s) {
    case 'pending':         return 'submissions.pending'
    case 'approved':        return 'submissions.approved'
    case 'rejected':        return 'submissions.rejected'
    case 'held':            return 'submissions.held'
    case 'moved_to_final':  return 'submissions.published'
    default:                return 'submissions.pending'
  }
}

/** Audio extensions — mirrors the admin QuestionsPage so reviewers and users
 *  see the same media split. */
const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|wav|flac|aiff)$/i
const isAudioUrl = (url: string) => AUDIO_EXT.test(url)

// ─── Modal ────────────────────────────────────────────────────────────────────

interface QuestionDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Question to load. Pass `null` when the dialog is closed so we short-circuit
   *  the fetch. */
  questionId: string | null
}

export function QuestionDetailModal({
  open, onOpenChange, questionId,
}: QuestionDetailModalProps): ReactNode {
  const { t } = useTranslation()

  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(false)
  // Distinguish "we couldn't find this question" (404 from API) from "still
  // loading" / "not yet fetched". This matters because we don't want the
  // not-found card to flash before the first fetch completes.
  const [notFound, setNotFound] = useState(false)

  const fetch = useCallback(async (id: string) => {
    setLoading(true)
    setNotFound(false)
    try {
      const data = await questionApi.getQuestion(id)
      setQuestion(data)
    } catch (e) {
      const msg = getErrorMessage(e, t('submissions.loadError'))
      toast.error(msg)
      // Only flip to not-found when the backend confirms the question is
      // missing (404). Other failures leave `question` untouched so the user
      // can retry without losing context.
      const status = (e as { status?: number })?.status
      if (status === 404) {
        setNotFound(true)
        setQuestion(null)
      }
    } finally {
      setLoading(false)
    }
  }, [t])

  // Re-fetch whenever the parent hands us a new id. Reset state when the
  // dialog closes so the next open starts fresh.
  useEffect(() => {
    if (!open) {
      setQuestion(null)
      setNotFound(false)
      setLoading(false)
      return
    }
    if (questionId) void fetch(questionId)
  }, [open, questionId, fetch])

  // ── Body switch ─────────────────────────────────────────────────
  let body: ReactNode
  if (loading) {
    body = (
      <Card>
        <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-text-tertiary">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="mt-3 text-[11px] sm:text-xs font-medium">{t('common.loading')}</p>
        </CardContent>
      </Card>
    )
  } else if (notFound || (!question && !loading)) {
    body = (
      <Card>
        <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-text-tertiary">
          <AlertCircle className="h-8 w-8 text-rose-500" />
          <p className="mt-3 text-xs sm:text-sm font-semibold text-foreground">
            {t('notifications.notFound')}
          </p>
          {questionId && (
            <button
              onClick={() => void fetch(questionId)}
              className="mt-3 inline-flex items-center justify-center rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-foreground transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            >
              {t('common.retry')}
            </button>
          )}
        </CardContent>
      </Card>
    )
  } else if (question) {
    body = <QuestionBody question={question} />
  } else {
    // Defensive fallback (shouldn't normally be reached).
    body = null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] sm:max-h-[88vh] max-w-2xl gap-0 overflow-y-auto p-0 sm:p-0">
        {/* Header — sticky so the status pill + submitted-on date stay in view
            while the user scrolls through long questions / many media items. */}
        {question && (
          <DialogHeader className="sticky top-0 z-10 border-b border-border-subtle bg-surface px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="text-base sm:text-lg font-extrabold leading-tight text-foreground">
                {t('notifications.yourQuestion')}
              </DialogTitle>
              <span className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                statusBadge(question.status),
              )}>
                {t(statusLabelKey(question.status))}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] sm:text-xs text-text-tertiary">
              {t('submissions.submitted')} {formatDateTime(question.submittedAt)}
            </p>
          </DialogHeader>
        )}

        <div className="space-y-3 px-4 py-4 sm:px-5">
          {body}
        </div>

        <p className="border-t border-border-subtle px-4 py-3 text-center text-[11px] sm:text-xs text-text-tertiary sm:px-5">
          AnnaDatha &mdash; To Strengthen Indian Farmers
        </p>
      </DialogContent>
    </Dialog>
  )
}

// ─── QuestionBody (rendered when the question is loaded) ─────────────────────

function QuestionBody({ question }: { question: Question }): ReactNode {
  const { t } = useTranslation()
  const mediaUrls = question.mediaUrls ?? []
  const imageUrls = mediaUrls.filter((u) => !isAudioUrl(u))
  const audioUrls = mediaUrls.filter(isAudioUrl)

  return (
    <>
      {/* ── Question text ──────────────────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-2 p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-text-secondary">
            <MessageSquareText className="h-4 w-4" />
            {t('notifications.yourQuestion')}
          </div>
          <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-foreground">
            {question.questionText}
          </p>
        </CardContent>
      </Card>

      {/* ── Context (language / domains / season / crop / location) ────── */}
      <Card>
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-text-secondary">
            <Hash className="h-4 w-4" />
            {t('notifications.context')}
          </div>

          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            {question.domains && question.domains.length > 0 && (
              <ContextRow
                icon={Hash}
                label={t('submissions.category')}
                value={question.domains.join(', ')}
              />
            )}
            {question.season && (
              <ContextRow icon={CloudRain} label={t('submissions.season')} value={question.season} />
            )}
            {question.cropType && (
              <ContextRow icon={Wheat} label={t('submissions.crop')} value={question.cropType} />
            )}
            {question.state && (
              <ContextRow
                icon={MapPin}
                label={t('wallet.questionState')}
                value={[question.state, question.district, question.block, question.village]
                  .filter(Boolean)
                  .join(', ')}
              />
            )}
          </dl>
        </CardContent>
      </Card>

      {/* ── Media (images + audio) ─────────────────────────────────────── */}
      {(imageUrls.length > 0 || audioUrls.length > 0) && (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-text-secondary">
              <ImageIcon className="h-4 w-4" />
              {t('submissions.questionDetails')}
            </div>

            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {imageUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={url}
                      alt={`upload-${i}`}
                      className="h-24 w-full rounded-md border border-border-subtle object-cover transition-opacity hover:opacity-80"
                    />
                  </a>
                ))}
              </div>
            )}

            {audioUrls.length > 0 && (
              <div className="space-y-2">
                {audioUrls.map((url, i) => (
                  <audio key={i} controls src={url} preload="metadata" className="h-10 w-full" />
                ))}
                <p className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
                  <Mic className="h-3 w-3" />
                  {t('question.audioModelDisclaimer')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Reviewer feedback (status-specific, only when populated) ─────── */}
      {(question.approvalReason || question.rejectionReason || question.heldReason) && (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            {question.rejectionReason && (
              <ReasonBlock variant="rejected" title={t('submissions.rejectionReason')} body={question.rejectionReason} />
            )}
            {question.approvalReason && (
              <ReasonBlock variant="approved" title={t('submissions.approvalReason')} body={question.approvalReason} />
            )}
            {question.heldReason && (
              <ReasonBlock variant="held" title={t('notifications.holdReason')} body={question.heldReason} />
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function ContextRow({ icon: Icon, label, value }: {
  icon: typeof MessageSquareText
  label: string
  value: string
}): ReactNode {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      <div className="min-w-0 flex-1">
        <dt className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{label}</dt>
        <dd className="mt-0.5 truncate text-xs sm:text-sm font-medium text-foreground" title={value}>{value}</dd>
      </div>
    </div>
  )
}

function ReasonBlock({ variant, title, body }: {
  variant: 'approved' | 'rejected' | 'held'
  title: string
  body: string
}): ReactNode {
  const palette = {
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300',
    held:     'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300',
  }[variant]

  return (
    <div className={cn('rounded-lg border p-3', palette)}>
      <p className="text-[11px] font-bold uppercase tracking-wider">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-xs sm:text-sm text-foreground">{body}</p>
    </div>
  )
}

export default QuestionDetailModal