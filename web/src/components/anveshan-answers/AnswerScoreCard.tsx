import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, Gauge, Loader2, MinusCircle, RotateCcw, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAnveshanAnswerScore } from '@/hooks/useAnveshanAnswerScore'
import type { AnveshanAnswerScore, AnveshanAnswerScoreCheck } from '@/types'

interface AnswerScoreCardProps {
  questionId: string
  initialScore: AnveshanAnswerScore | null
  onScoreChange?: (score: AnveshanAnswerScore) => void
}

// System score for a submitted advisory: a scoring state while it runs, then the score and each check.
export function AnswerScoreCard({ questionId, initialScore, onScoreChange }: AnswerScoreCardProps) {
  const { t } = useTranslation()
  const { score, isPolling, timedOut, checkAgain } = useAnveshanAnswerScore(questionId, initialScore, onScoreChange)

  if (score?.status === 'completed') return <CompletedScore score={score} />
  // A failed job can still return a partial score; show it with a way to score again.
  if (score?.status === 'failed' && hasScore(score) && !isPolling) {
    return <CompletedScore score={score} onCheckAgain={checkAgain} />
  }

  if (isPolling) {
    return (
      <ScoreShell>
        <div role="status" className="flex items-center gap-3 text-sm text-text-secondary">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
          <span>
            {t('anveshanAnswers.score.processing', 'Scoring your advisory. This can take a few minutes; you can close this and come back later.')}
          </span>
        </div>
      </ScoreShell>
    )
  }

  const message = timedOut
    ? t('anveshanAnswers.score.timedOut', 'Scoring is taking longer than usual. Your advisory is saved; check again in a moment.')
    : score?.status === 'failed'
      ? t('anveshanAnswers.score.failed', 'We could not score your advisory right now. Your advisory is saved.')
      : t('anveshanAnswers.score.notScored', 'This advisory has not been scored yet.')

  return (
    <ScoreShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-text-secondary">{message}</p>
        <Button type="button" variant="outline" size="sm" onClick={checkAgain} className="shrink-0 gap-1.5 self-start sm:self-auto">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('anveshanAnswers.score.checkAgain', 'Check score')}
        </Button>
      </div>
    </ScoreShell>
  )
}

// Card frame and title shared by every score state.
function ScoreShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <section className="space-y-3 rounded-xl border border-border-subtle bg-surface-variant/40 p-4" aria-live="polite">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
        <Gauge className="h-4 w-4 text-primary" aria-hidden="true" />
        {t('anveshanAnswers.score.title', 'System score')}
      </h3>
      {children}
    </section>
  )
}

interface CompletedScoreProps {
  score: AnveshanAnswerScore
  /** Set for a partial score from a failed job, to offer scoring again. */
  onCheckAgain?: () => void
}

// Score summary, review flag and the individual checks once scoring has finished.
function CompletedScore({ score, onCheckAgain }: CompletedScoreProps) {
  const { t } = useTranslation()
  const percentage = Math.max(0, Math.min(100, Math.round(score.percentage ?? 0)))
  const tone = scoreTone(percentage)

  return (
    <ScoreShell>
      <div className="flex items-end justify-between gap-3">
        <p className={cn('text-3xl font-bold leading-none', tone.text)}>{percentage}%</p>
        {score.systemScore !== null && score.maxScore !== null && (
          <p className="text-sm font-medium text-text-secondary">
            {t('anveshanAnswers.score.points', {
              score: score.systemScore,
              max: score.maxScore,
              defaultValue: '{{score}} of {{max}} points',
            })}
          </p>
        )}
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-border-subtle"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        aria-label={t('anveshanAnswers.score.title', 'System score')}
      >
        <div className={cn('h-full rounded-full transition-all duration-500', tone.bar)} style={{ width: `${percentage}%` }} />
      </div>

      {onCheckAgain && (
        <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-secondary">
            {t(
              'anveshanAnswers.score.partial',
              'Some checks could not run this time, so this score is incomplete. Your advisory is saved.',
            )}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onCheckAgain} className="shrink-0 gap-1.5 self-start sm:self-auto">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {t('anveshanAnswers.score.scoreAgain', 'Score again')}
          </Button>
        </div>
      )}

      {(score.needsHumanReview || score.reviewReasons.length > 0) && (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">
              {score.needsHumanReview
                ? t('anveshanAnswers.score.needsReview', 'An expert will also review this advisory.')
                : t('anveshanAnswers.score.reasons', 'Why you got this score')}
            </p>
            {score.reviewReasons.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4">
                {score.reviewReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {score.checks.length > 0 && (
        <p className="text-xs font-medium text-text-secondary">
          {t('anveshanAnswers.score.checksTitle', 'Score breakdown')}
        </p>
      )}
      {score.checks.length > 0 && (
        <ul className="divide-y divide-border-subtle rounded-lg border border-border-subtle bg-surface">
          {score.checks.map((check) => (
            <ScoreCheckRow key={`${check.category}-${check.parameter}`} check={check} />
          ))}
        </ul>
      )}

      {score.notApplicable.length > 0 && (
        <p className="text-xs text-text-tertiary">
          {t('anveshanAnswers.score.notApplicable', 'Not applicable to this advisory:')}{' '}
          {score.notApplicable.map(humanizeParameter).join(', ')}
        </p>
      )}
    </ScoreShell>
  )
}

// One check with an icon and a text result, so the outcome does not depend on colour alone.
function ScoreCheckRow({ check }: { check: AnveshanAnswerScoreCheck }) {
  const { t } = useTranslation()
  const result = check.result.toUpperCase()
  const resultLabel =
    result === 'PASS'
      ? t('anveshanAnswers.score.pass', 'Pass')
      : result === 'FAIL'
        ? t('anveshanAnswers.score.fail', 'Fail')
        : result === 'NOT_EVALUATED'
          ? t('anveshanAnswers.score.notEvaluated', 'Not evaluated')
          : humanizeParameter(check.result.toLowerCase())
  const Icon = result === 'PASS' ? CheckCircle2 : result === 'FAIL' ? XCircle : MinusCircle
  const iconClass =
    result === 'PASS'
      ? 'text-emerald-600 dark:text-emerald-400'
      : result === 'FAIL'
        ? 'text-destructive'
        : 'text-text-tertiary'

  return (
    <li className="flex gap-2.5 px-3 py-2.5">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-text">{humanizeParameter(check.parameter)}</p>
          <span className="shrink-0 text-xs font-semibold text-text-secondary">
            {check.mark === null ? resultLabel : `${resultLabel} · ${check.mark}`}
          </span>
        </div>
        {check.reason && <p className="mt-0.5 break-words text-sm text-text-secondary">{check.reason}</p>}
      </div>
    </li>
  )
}

// True when the scoring service returned at least a score or some checks.
function hasScore(score: AnveshanAnswerScore): boolean {
  return score.percentage !== null || score.checks.length > 0
}

// Colour band for the score: 80% and above is good, 50% and above is fair, otherwise low.
function scoreTone(percentage: number) {
  if (percentage >= 80) return { text: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500' }
  if (percentage >= 50) return { text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500' }
  return { text: 'text-destructive', bar: 'bg-destructive' }
}

// Turns a scoring parameter key such as banned_chemical into "Banned chemical".
function humanizeParameter(parameter: string): string {
  const words = parameter.replace(/_/g, ' ').trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : parameter
}
