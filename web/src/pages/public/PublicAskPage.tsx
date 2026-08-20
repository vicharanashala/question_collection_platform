import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { questionApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, Send, ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, MapPin, Lock, Info, Mic } from 'lucide-react'
import { toast } from 'sonner'
import { DOMAINS, SEASONS, MAX_QUESTION_CHARS } from '@/constants/public'
import { MicButton } from '@/components/MicButton'
import { CropPickerModal } from '@/components/ui/crop-picker-modal'
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

// Server-derived fields from `questionApi.preview` — location/zone are locked
// to the user's profile (not user-editable), domain/season/crop seed the
// details-step form but remain adjustable before final submit.
interface PreviewMeta {
  state: string
  district: string
  block: string | null
  agroClimaticZone: string
  remainingToday: number
  dailyLimit: number
}

// ─── Crop Type picker modal ────────────────────────────────────────────────────
// Mirrors the mobile `Select` component's bottom-sheet behaviour for the
// `cropType` field on `QuestionPreviewScreen`: search-driven, alphabetised,
// single-select with an "Other (enter manually)" fallback so users whose crop
// isn't in the list can still submit. Module-scope so its identity is stable
// across renders (same rationale as MobileStage / OtpStage in PublicRegisterPage).


export function PublicAskPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  // ─── Two-step flow ─────────────────────────────────────────────────────────
  // Mirrors mobile's QuestionScreen → QuestionPreviewScreen split: the user
  // first writes their question text, then `questionApi.preview` classifies
  // it server-side (Gemma LLM) and returns suggested domain(s)/season/crop
  // plus profile-derived location, which seed the details step below instead
  // of the user picking everything from empty dropdowns.
  const [step, setStep] = useState<'ask' | 'details'>('ask')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta | null>(null)

  const [questionText, setQuestionText] = useState('')
  const [domains, setDomains] = useState<string[]>([])
  const [season, setSeason] = useState<string>('')
  const [cropType, setCropType] = useState('')
  const [cropPickerOpen, setCropPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [stats, setStats] = useState<{ remainingToday: number; dailyLimit: number } | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null)
  const [micExpanded, setMicExpanded] = useState(true)

  const atLimit = stats != null && stats.remainingToday <= 0

  // Lock body scroll on the details step to prevent pull-to-scroll ghosting
  useEffect(() => {
    if (step === 'details') {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [step])

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

  function toggleDomain(d: string) {
    setDomains((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }

  function resetAll() {
    setStep('ask')
    setQuestionText('')
    setDomains([])
    setSeason('')
    setCropType('')
    setPreviewMeta(null)
  }

  // ─── Step 1 → Step 2: classify the question text server-side ─────────────
  // Mirrors mobile `QuestionScreen.handlePreview`: the raw text is sent to
  // `/questions/preview`, which runs an LLM classifier + profile lookup and
  // returns suggested domain(s)/season/crop/location. If the backend's
  // duplicate check matches an existing question it's saved as REJECTED
  // immediately and we show the duplicate screen instead of advancing.
  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!questionText.trim()) { toast.error(t('question.enterQuestion')); return }
    if (questionText.length > MAX_QUESTION_CHARS) { toast.error(t('question.textTooLong', { max: MAX_QUESTION_CHARS })); return }
    if (atLimit) { toast.error(t('question.errors.dailyLimitReached')); return }
    if (!user?.state || !user?.district) { toast.error(t('question.errors.locationMissing')); return }
    // Hard block: AI flagged as spam. Don't waste a server round-trip.
    if (blockedByAi) { toast.error(t('question.errors.rewriteSpam')); return }

    setPreviewLoading(true)
    try {
      const res = await questionApi.preview({
        questionText: questionText.trim(),
        mediaType: 'none',
        mediaUrls: [],
      })
      if (res.duplicate?.isDuplicate) {
        setDuplicate({
          matchedQuestion: res.duplicate.matchedQuestion ?? '',
          matchedAnswer: res.duplicate.matchedAnswer,
          similarityScore: res.duplicate.similarityScore,
          matchedUserName: res.duplicate.matchedUserName,
        })
        questionApi.getMyStats()
          .then((s) => setStats({ remainingToday: (s as any).remainingToday ?? 20, dailyLimit: (s as any).dailyLimit ?? 20 }))
          .catch(() => undefined)
        return
      }
      setPreviewMeta({
        state: res.state ?? user.state,
        district: res.district ?? user.district,
        block: res.block ?? user.block ?? null,
        agroClimaticZone: res.agroClimaticZone ?? '',
        remainingToday: res.remainingToday ?? stats?.remainingToday ?? 0,
        dailyLimit: res.dailyLimit ?? stats?.dailyLimit ?? 20,
      })
      setDomains(res.domains ?? [])
      setSeason(res.season || '')
      setCropType(res.cropType ?? '')
      setStep('details')
    } catch (err) {
      toast.error(getErrorMessage(err, t('question.submitFailed')))
    } finally {
      setPreviewLoading(false)
    }
  }

  // ─── Step 2: final submit ──────────────────────────────────────────────────
  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!previewMeta) return
    if (!questionText.trim()) { toast.error(t('question.enterQuestion')); return }
    if (!domains.length) { toast.error(t('question.errors.pickDomain')); return }
    if (!season) { toast.error(t('question.errors.pickSeason')); return }
    if (!cropType.trim()) { toast.error(t('question.errors.enterCrop')); return }

    setSubmitting(true)
    try {
      const res = await questionApi.submitQuestion({
        questionText: questionText.trim(),
        domains,
        season,
        cropType: cropType.trim(),
        state: previewMeta.state,
        district: previewMeta.district,
        block: previewMeta.block ?? undefined,
        agroClimaticZone: previewMeta.agroClimaticZone || undefined,
        mediaType: 'none',
      })
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
        <Card className="border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-500/8 to-transparent">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
              <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg sm:text-lg sm:text-xl font-bold text-foreground">{t('question.submitted')}</h2>
            <p className="mt-2 text-xs sm:text-xs sm:text-sm text-text-secondary max-w-sm">{t('question.successBody')}</p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => { setSubmitted(false); resetAll() }}>{t('question.submitAnother')}</Button>
              <Button onClick={() => navigate('/home/questions')}>{t('nav.submissions')}</Button>
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
                <h3 className="text-xs sm:text-xs sm:text-sm font-bold text-foreground">{t('question.duplicateFoundTitle')}</h3>
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-secondary mt-1">{t('question.duplicateFoundMessage')}</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4 dark:bg-surface">
              <p className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground">{duplicate.matchedQuestion}</p>
              {duplicate.matchedAnswer && (
                <div className="mt-3 border-t border-amber-100 pt-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">{t('question.duplicate.expertAnswer')}</p>
                  <p className="mt-1 text-xs sm:text-xs sm:text-sm text-foreground whitespace-pre-wrap">{duplicate.matchedAnswer}</p>
                </div>
              )}
              {duplicate.matchedUserName && <p className="mt-3 text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">{t('question.duplicate.answeredBy', { name: duplicate.matchedUserName })}</p>}
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => navigate('/home')}>{t('question.duplicate.backHome')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Step 2 — details form, seeded from the preview response ─────────────
  if (step === 'details' && previewMeta) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => setStep('ask')} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />{t('common.back', 'Back')}
          </Button>
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span className="font-medium text-foreground">1</span>
            <div className="h-px w-8 bg-border-subtle" />
            <span className="font-semibold text-emerald-600">2</span>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground">{t('question.submitQuestion')}</h2>
          <p className="text-sm text-text-secondary mt-0.5">{t('question.askSubtitle')}</p>
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>{t('question.notEditableAfterSubmission', 'This question is not editable after submission')}</span>
        </div>

        {/* Question preview card — prominent display of what the user typed */}
        <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-surface dark:from-emerald-950/20 dark:border-emerald-900/30">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Q</span>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">{t('question.yourQuestion')}</span>
            </div>
            <p className="text-base leading-relaxed text-foreground pl-6 sm:pl-8">{questionText}</p>
            <div className="mt-3 pl-6 sm:pl-8 flex items-center gap-1.5 text-[11px] text-text-tertiary">
              <Lock className="h-3 w-3" />
              {t('question.locationLockedNote')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 lg:p-6">
            <form onSubmit={handleFinalSubmit} className="space-y-6">
              <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
                {/* Left column — read-only location + zone */}
                <div className="space-y-4 lg:col-span-2">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-semibold text-foreground">{t('question.location')}</span>
                    </div>
                    <div className="rounded-xl border border-border-subtle bg-surface-variant/50 p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-tertiary">{t('question.state')}</span>
                        <span className="text-sm font-medium text-foreground">{previewMeta.state}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-tertiary">{t('question.district')}</span>
                        <span className="text-sm font-medium text-foreground">{previewMeta.district}</span>
                      </div>
                      {previewMeta.block && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-tertiary">{t('question.blockOptional')}</span>
                          <span className="text-sm font-medium text-foreground">{previewMeta.block}</span>
                        </div>
                      )}
                      <div className="border-t border-border-subtle pt-2 flex items-center gap-1.5 text-[11px] text-text-tertiary">
                        <Lock className="h-3 w-3" />
                        {t('question.locationLockedNote')}
                      </div>
                    </div>
                  </div>

                  {previewMeta.agroClimaticZone && (
                    <div>
                      <span className="text-xs text-text-tertiary mb-1.5 block">{t('question.agroClimaticZone', 'Agro-Climatic Zone')}</span>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {previewMeta.agroClimaticZone}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl bg-muted/60 px-4 py-2.5 text-xs text-text-secondary text-center">
                    {t('question.dailyRemaining', { remaining: previewMeta.remainingToday, total: previewMeta.dailyLimit })}
                  </div>
                </div>

                {/* Right column — editable fields */}
                <div className="flex flex-col gap-5 lg:col-span-3">
                  {/* Domain pills */}
                  <div className="space-y-2.5">
                    <div>
                      <Label className="text-sm">{t('question.domainSelect')} <span className="text-rose-600">*</span></Label>
                      <p className="text-[11px] text-text-tertiary mt-0.5">{t('question.selectOneOrMore', 'Select one or more')}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {DOMAINS.map((d) => {
                        const selected = domains.includes(d.value)
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleDomain(d.value)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${selected
                                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 shadow-sm dark:text-emerald-300'
                                : 'border-border-subtle bg-surface text-text-secondary hover:border-emerald-300 hover:text-emerald-700'
                              }`}
                          >
                            {selected && <CheckCircle2 className="h-3.5 w-3.5" />}
                            {d.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Season + Crop row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">{t('question.season')} <span className="text-rose-600">*</span></Label>
                      <Select value={season} onValueChange={setSeason}>
                        <SelectTrigger className="h-10"><SelectValue placeholder={t('question.pickSeason')} /></SelectTrigger>
                        <SelectContent>
                          {SEASONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="crop" className="text-sm">{t('question.cropType')} <span className="text-rose-600">*</span></Label>
                      <button
                        id="crop"
                        type="button"
                        onClick={() => setCropPickerOpen(true)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-border-subtle bg-surface-variant px-3 text-sm shadow-sm transition-colors hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                      >
                        <span className={cropType ? 'text-foreground' : 'text-text-tertiary'}>
                          {cropType || t('question.pickCrop')}
                        </span>
                        <svg className="h-4 w-4 text-text-tertiary" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Question textarea */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="q-details" className="text-sm">{t('question.yourQuestion')} <span className="text-rose-600">*</span></Label>
                    <Textarea
                      id="q-details"
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      rows={4}
                      maxLength={MAX_QUESTION_CHARS}
                      className="resize-none text-sm leading-relaxed"
                      placeholder={t('question.questionExample')}
                    />
                    <div className="flex justify-end">
                      <span className={`text-[11px] ${questionText.length > MAX_QUESTION_CHARS - 50 ? 'text-amber-600 font-semibold' : 'text-text-tertiary'}`}>
                        {questionText.length}/{MAX_QUESTION_CHARS}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit row */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-border-subtle">
                <Button type="button" variant="outline" size="sm" onClick={() => setStep('ask')}>
                  {t('common.back', 'Back')}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !questionText.trim() || !domains.length || !season || !cropType.trim()}
                  className="gap-2"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t('question.submitQuestion')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <CropPickerModal
          open={cropPickerOpen}
          onOpenChange={setCropPickerOpen}
          selected={cropType ? [cropType] : []}
          onSelectionChange={(crops) => setCropType(crops[0] ?? '')}
          mode="single"
          title={t('question.cropType')}
        />
      </div>
    )
  }

  // ─── Step 1 — free-text question entry ─────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />{t('common.back', 'Back')}
        </Button>
        <div className="text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">
          {stats ? (
            <span className={atLimit ? 'text-rose-600 font-semibold' : 'text-emerald-700 dark:text-emerald-300 font-medium'}>
              {atLimit ? t('question.dailyLimitIndicator') : t('question.dailyLeftToday', { remaining: stats.remainingToday, total: stats.dailyLimit })}
            </span>
          ) : '…'}
        </div>
      </div>
      <div>
        <h2 className="text-lg sm:text-lg sm:text-xl font-bold text-foreground">{t('question.askQuestion')}</h2>
        <p className="text-xs sm:text-xs sm:text-sm text-text-secondary mt-0.5">{t('question.expertWillRespond')}</p>
      </div>
      <Card>
        <CardContent className="p-5 lg:p-6">
          <form onSubmit={handleContinue} className="space-y-4">
            {/* Question (primary field) + Voice input (secondary field) sit
                side by side on desktop instead of one long stacked column, so
                the wide viewport isn't mostly empty. Domain/Season/Crop are no
                longer picked here — `questionApi.preview` suggests them on the
                next step, same as mobile's QuestionScreen → QuestionPreviewScreen. */}
            <div className="grid gap-5 lg:grid-cols-5 lg:gap-6">
              <div className="flex flex-col gap-1.5 lg:col-span-3">
                <Label htmlFor="q">{t('question.yourQuestion')} <span className="text-rose-600">*</span></Label>
                <Textarea
                  id="q"
                  placeholder={t('question.questionExample')}
                  value={questionText}
                  onChange={(e) => {
                    setQuestionText(e.target.value)
                    if (e.target.value.trim()) setMicExpanded(false)
                  }}
                  rows={8}
                  maxLength={MAX_QUESTION_CHARS}
                  className="resize-none lg:flex-1"
                />
                <div className="flex items-center justify-between text-[11px] sm:text-[11px] sm:text-xs">
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

              <div className="flex flex-col lg:col-span-2">
                {/* ── Voice input — mirrors the mobile `SttMicButton` dock.
                     Disabled when the daily limit is reached or the AI flagged
                     the text as spam, so the user can't circumvent validation
                     by typing fresh text after submitting a flagged one. */}
                <AnimatePresence initial={false}>
                  {micExpanded ? (
                    <motion.div
                      key="mic-expanded"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-border-subtle bg-surface-variant/40 px-4 py-5">
                        <MicButton
                          onRecordingStart={() => {
                            setBannerDismissed(false)
                          }}
                          onTranscribed={(text) => {
                            setQuestionText((prev) => {
                              const base = prev.trim()
                              return base ? `${base} ${text}` : text
                            })
                            requestAnimationFrame(() => {
                              document.getElementById('q')?.focus()
                            })
                          }}
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="mic-collapsed"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden flex justify-center py-1"
                    >
                      <button
                        type="button"
                        onClick={() => setMicExpanded(true)}
                        className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-variant/40 px-3 py-1.5 text-xs text-text-tertiary hover:border-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                      >
                        <Mic className="h-3.5 w-3.5" />
                        <span>{t('question.addVoice', 'Add voice')}</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>{t('common.cancel', 'Cancel')}</Button>
              {/*
                Mirror mobile `QuestionScreen`'s Continue button: when the AI
                flags the text as spam or "too short" (verdict === 'fail'),
                show "Not Relevant" instead of "Continue". Stays disabled so
                the user can't bypass the validation.
              */}
              <Button
                type="submit"
                disabled={previewLoading || submitting || atLimit || blockedByAi || !questionText.trim()}
              >
                {previewLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {blockedByAi ? t('question.notRelevant') : t('common.continue', 'Continue')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}