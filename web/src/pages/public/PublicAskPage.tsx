import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { questionApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Send, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { DOMAINS, SEASONS, MAX_QUESTION_CHARS, CROPS } from '@/constants/public'
import { MicButton } from '@/components/MicButton'
import { AIValidationBanner } from '@/components/AIValidationBanner'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import {
  runOnDeviceValidation,
  cacheQuestionForDuplicateDetection,
  type AIValidationResult,
} from '@/utils/onDeviceAI'

interface DuplicateInfo {
  matchedQuestion: string
  matchedAnswer: string | null
  similarityScore: number | null
  matchedUserName: string | null
}

// ─── Crop Type picker modal ────────────────────────────────────────────────────
// Mirrors the mobile `Select` component's bottom-sheet behaviour for the
// `cropType` field on `QuestionPreviewScreen`: search-driven, alphabetised,
// single-select with an "Other (enter manually)" fallback so users whose crop
// isn't in the list can still submit. Module-scope so its identity is stable
// across renders (same rationale as MobileStage / OtpStage in PublicRegisterPage).
interface CropPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onChange: (value: string) => void
}

function CropPickerModal({ open, onOpenChange, value, onChange }: CropPickerModalProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [otherText, setOtherText] = useState('')
  const [showOther, setShowOther] = useState(false)

  // `CROPS` is the full 340+ list mirrored from mobile's `Select` component.
  // We render it as `{ value, label }` option objects on the fly.
  const cropOptions = useMemo(() => CROPS.map((c) => ({ value: c, label: c })), [])
  const filtered = useMemo(() => {
    if (!query.trim()) return cropOptions
    const q = query.toLowerCase()
    return cropOptions.filter((o) => o.label.toLowerCase().includes(q))
  }, [query, cropOptions])

  function pickCrop(v: string) {
    onChange(v)
    setQuery('')
    setShowOther(false)
    setOtherText('')
    onOpenChange(false)
  }

  function pickOther() {
    setShowOther(true)
  }

  function confirmOther() {
    const v = otherText.trim()
    if (!v) return
    pickCrop(v)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setQuery(''); setShowOther(false); setOtherText('') } }}>
      <DialogContent className="max-w-md p-0 sm:max-w-md">
        <DialogHeader className="flex-row items-center justify-between border-b border-border-subtle px-4 py-3">
          <DialogTitle className="text-base font-semibold">{t('question.cropType')}</DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-text-tertiary hover:bg-surface-variant hover:text-foreground focus:outline-none focus:ring-2 focus:ring-focus"
            aria-label={t('common.close', 'Close')}
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowOther(false) }}
              placeholder={t('admin.search')}
              className="pl-9"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto px-2 pb-2">
          {showOther ? (
            <div className="px-2 py-3 space-y-2">
              <Label htmlFor="other-crop">{t('question.enterCrop')}</Label>
              <Input
                id="other-crop"
                autoFocus
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder={t('question.cropLocalPlaceholder')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmOther() } }}
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowOther(false); setOtherText('') }}>{t('common.back', 'Back')}</Button>
                <Button type="button" size="sm" disabled={!otherText.trim()} onClick={confirmOther}>{t('common.use', 'Use this crop')}</Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-tertiary">{t('common.noMatches', 'No matches')}</p>
          ) : (
            <ul className="py-1">
              {filtered.map((c) => (
                <li key={c.value}>
                  <button
                    type="button"
                    onClick={() => pickCrop(c.value)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-variant ${value === c.value ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/30 dark:text-emerald-300' : 'text-foreground'}`}
                  >
                    <span>{c.label}</span>
                    {value === c.value && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={pickOther}
                  className="mt-1 flex w-full items-center rounded-md border-t border-border-subtle px-3 py-2.5 text-left text-sm font-medium text-emerald-700 hover:bg-surface-variant dark:text-emerald-300"
                >
                  {t('question.cropOtherManually')}
                </button>
              </li>
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function PublicAskPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [questionText, setQuestionText] = useState('')
  const [domain, setDomain] = useState<string>('')
  const [season, setSeason] = useState<string>('')
  const [cropType, setCropType] = useState('')
  const [cropPickerOpen, setCropPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [stats, setStats] = useState<{ remainingToday: number; dailyLimit: number } | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null)

  const atLimit = stats != null && stats.remainingToday <= 0

  // ─── On-device AI validation pipeline ─────────────────────────────────────
  // Debounced run of `runOnDeviceValidation` against the live question text.
  // Mirrors the mobile `QuestionScreen` behaviour: warn the user when their
  // text looks off-topic or duplicates a recent submission, block submit on
  // spam verdict.
  const debouncedQuestion = useDebouncedValue(questionText, 600)
  const [aiValidation, setAiValidation] = useState<AIValidationResult | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  // Sequence counter prevents out-of-order results from clobbering the latest.
  const validationSeqRef = useRef(0)

  useEffect(() => {
    const text = debouncedQuestion.trim()
    if (text.length === 0) {
      setAiValidation(null)
      return
    }
    // Always run the pipeline, even for short input — `isLikelySpam` now
    // emits `onDeviceAI.spam.tooShort` for `< 3 words`, producing the
    // "Please describe your agriculture question in more detail." banner
    // that mobile shows. Mirrors `mobile/src/screens/Question/QuestionScreen.tsx`.
    const seq = ++validationSeqRef.current
    runOnDeviceValidation(text).then((r) => {
      if (seq !== validationSeqRef.current) return // stale response
      setAiValidation(r)
      // Reset dismiss when the verdict category changes
      setBannerDismissed(false)
    })
  }, [debouncedQuestion])

  // Submit is hard-blocked when the AI flags the text as spam (incl. "too short").
  const blockedByAi = aiValidation?.verdict === 'fail'
  const showBanner =
    aiValidation &&
    aiValidation.verdict !== 'pass' &&
    !bannerDismissed

  // ─── Stats (daily limit counter) ──────────────────────────────────────────
  useEffect(() => {
    questionApi.getMyStats()
      .then((s) => setStats({ remainingToday: (s as any).remainingToday ?? 20, dailyLimit: (s as any).dailyLimit ?? 20 }))
      .catch(() => { setStats({ remainingToday: 20, dailyLimit: 20 }) })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!questionText.trim()) { toast.error(t('question.enterQuestion')); return }
    if (questionText.length > MAX_QUESTION_CHARS) { toast.error(t('question.textTooLong', { max: MAX_QUESTION_CHARS })); return }
    if (!domain) { toast.error(t('question.errors.pickDomain')); return }
    if (!season) { toast.error(t('question.errors.pickSeason')); return }
    if (!cropType.trim()) { toast.error(t('question.errors.enterCrop')); return }
    if (atLimit) { toast.error(t('question.errors.dailyLimitReached')); return }
    if (!user?.state || !user?.district) { toast.error(t('question.errors.locationMissing')); return }
    // Hard block: AI flagged as spam. Don't waste a server round-trip.
    if (blockedByAi) { toast.error(t('question.errors.rewriteSpam')); return }

    setSubmitting(true)
    try {
      const res = await questionApi.submitQuestion({
        questionText: questionText.trim(),
        domains: [domain],
        season,
        cropType: cropType.trim(),
        state: user.state,
        district: user.district,
        block: user.block ?? undefined,
        mediaType: 'none',
      } as any)
      if (res.duplicate?.isDuplicate) {
        setDuplicate({
          matchedQuestion: res.duplicate.matchedQuestion ?? '',
          matchedAnswer: res.duplicate.matchedAnswer,
          similarityScore: res.duplicate.similarityScore,
          matchedUserName: res.duplicate.matchedUserName,
        })
        return
      }
      toast.success(res.message || 'Question submitted!')
      // Cache the submitted question so future drafts are checked against it
      // for near-duplicates (Levenshtein similarity ≥ 0.82). The submit
      // endpoint returns either `{ id: string, status, message }` (current
      // shape) or `{ id, question: { id }, ... }` (newer variants) — handle
      // both without throwing.
      const newId: string | undefined =
        (res as any)?.id ?? (res as any)?.question?.id ?? undefined
      cacheQuestionForDuplicateDetection(questionText.trim(), newId)
      setSubmitted(true)
      questionApi.getMyStats()
        .then((s) => setStats({ remainingToday: (s as any).remainingToday ?? 20, dailyLimit: (s as any).dailyLimit ?? 20 }))
        .catch(() => undefined)
    } catch (err) {
      toast.error(getErrorMessage(err, t('question.submitFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg pt-8">
        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-500/8 to-transparent">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{t('question.submitted')}</h2>
            <p className="mt-2 text-sm text-text-secondary max-w-sm">{t('question.successBody')}</p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => { setSubmitted(false); setQuestionText(''); setDomain(''); setSeason(''); setCropType('') }}>{t('question.submitAnother')}</Button>
              <Button onClick={() => navigate('/public/questions')}>{t('nav.submissions')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (duplicate) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pt-6">
        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-foreground">{t('question.duplicateFoundTitle')}</h3>
                <p className="text-xs text-text-secondary mt-1">{t('question.duplicateFoundMessage')}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4 dark:bg-surface">
              <p className="text-sm font-semibold text-foreground">{duplicate.matchedQuestion}</p>
              {duplicate.matchedAnswer && (
                <div className="mt-3 border-t border-amber-100 pt-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">{t('question.duplicate.expertAnswer')}</p>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{duplicate.matchedAnswer}</p>
                </div>
              )}
              {duplicate.matchedUserName && <p className="mt-3 text-xs text-text-tertiary">{t('question.duplicate.answeredBy', { name: duplicate.matchedUserName })}</p>}
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" onClick={() => { setDuplicate(null); setQuestionText('') }}>{t('question.duplicate.askAnyway')}</Button>
              <Button onClick={() => navigate('/public')}>{t('question.duplicate.backHome')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />{t('common.back', 'Back')}
        </Button>
        <div className="text-xs text-text-tertiary">
          {stats ? (
            <span className={atLimit ? 'text-rose-600 font-semibold' : 'text-emerald-700 font-medium'}>
              {atLimit ? t('question.dailyLimitIndicator') : t('question.dailyLeftToday', { remaining: stats.remainingToday, total: stats.dailyLimit })}
            </span>
          ) : '…'}
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">{t('question.askQuestion')}</h2>
        <p className="text-sm text-text-secondary mt-0.5">{t('question.expertWillRespond')}</p>
      </div>
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="q">{t('question.yourQuestion')} <span className="text-rose-600">*</span></Label>
              <Textarea id="q" placeholder={t('question.questionExample')} value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={4} maxLength={MAX_QUESTION_CHARS} className="resize-none" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary">{t('question.tipDetailed')}</span>
                <span className={questionText.length > MAX_QUESTION_CHARS - 50 ? 'text-amber-600 font-semibold' : 'text-text-tertiary'}>{questionText.length}/{MAX_QUESTION_CHARS}</span>
              </div>
              {/* Inline AI validation banner — same semantics as the mobile
                  `AIValidationBanner`: warns on off-topic / duplicate, blocks
                  on spam. Only rendered when there's something to surface. */}
              {showBanner && aiValidation && (
                <AIValidationBanner
                  result={aiValidation}
                  onDismiss={() => setBannerDismissed(true)}
                />
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('question.domain')} <span className="text-rose-600">*</span></Label>
                <Select value={domain} onValueChange={setDomain}>
                  <SelectTrigger><SelectValue placeholder={t('question.pickDomain')} /></SelectTrigger>
                  <SelectContent>
                    {DOMAINS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('question.season')} <span className="text-rose-600">*</span></Label>
                <Select value={season} onValueChange={setSeason}>
                  <SelectTrigger><SelectValue placeholder={t('question.pickSeason')} /></SelectTrigger>
                  <SelectContent>
                    {SEASONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crop">{t('question.cropType')} <span className="text-rose-600">*</span></Label>
              <button
                id="crop"
                type="button"
                onClick={() => setCropPickerOpen(true)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-border-subtle bg-surface-variant px-3 py-1 text-sm shadow-sm transition-colors hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                <span className={cropType ? 'text-text' : 'text-text-tertiary'}>
                  {cropType || t('question.pickCrop')}
                </span>
                <svg className="h-4 w-4 text-text-tertiary" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {/* ── Voice input — mirrors the mobile `SttMicButton` dock.
                 Disabled when the daily limit is reached or the AI flagged
                 the text as spam, so the user can't circumvent validation
                 by typing fresh text after submitting a flagged one. */}
            <div className="rounded-lg border border-border-subtle bg-surface-variant/40 px-4 py-5">
              <MicButton
                disabled={atLimit || blockedByAi}
                onRecordingStart={() => {
                  // Clear any stale banner dismissal when a new recording
                  // starts so the user can re-evaluate their question.
                  setBannerDismissed(false)
                }}
                onTranscribed={(text) => {
                  setQuestionText((prev) => {
                    const base = prev.trim()
                    // Append with a space separator when joining with prior text
                    return base ? `${base} ${text}` : text
                  })
                  // Re-focus the textarea so the user can edit immediately
                  requestAnimationFrame(() => {
                    document.getElementById('q')?.focus()
                  })
                }}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>{t('common.cancel', 'Cancel')}</Button>
              {/*
                Mirror mobile `QuestionScreen`'s submit button: when the AI
                flags the text as spam or "too short" (verdict === 'fail'),
                show "Not Relevant" + a forward arrow instead of the usual
                "Submit question" + send icon. Stays disabled so the user can't
                bypass the validation.
              */}
              <Button
                type="submit"
                disabled={
                  submitting ||
                  atLimit ||
                  blockedByAi ||
                  !questionText.trim() ||
                  !domain ||
                  !season ||
                  !cropType.trim()
                }
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : blockedByAi ? (
                  <ArrowRight className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {blockedByAi ? t('question.notRelevant') : t('question.submitQuestion')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <CropPickerModal
        open={cropPickerOpen}
        onOpenChange={setCropPickerOpen}
        value={cropType}
        onChange={setCropType}
      />
    </div>
  )
}