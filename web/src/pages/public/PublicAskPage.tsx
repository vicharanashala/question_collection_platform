import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { questionApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Loader2, Send, Lightbulb, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { DOMAINS, SEASONS, MAX_QUESTION_CHARS } from '@/constants/public'

interface DuplicateInfo {
  matchedQuestion: string
  matchedAnswer: string | null
  similarityScore: number | null
  matchedUserName: string | null
}

export function PublicAskPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [questionText, setQuestionText] = useState('')
  const [domain, setDomain] = useState<string>('')
  const [season, setSeason] = useState<string>('')
  const [cropType, setCropType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [stats, setStats] = useState<{ remainingToday: number; dailyLimit: number } | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null)

  const atLimit = stats != null && stats.remainingToday <= 0

  useEffect(() => {
    questionApi.getMyStats()
      .then((s) => setStats({ remainingToday: (s as any).remainingToday ?? 20, dailyLimit: (s as any).dailyLimit ?? 20 }))
      .catch(() => { setStats({ remainingToday: 20, dailyLimit: 20 }) })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!questionText.trim()) { toast.error('Please enter your question'); return }
    if (questionText.length > MAX_QUESTION_CHARS) { toast.error(`Question must be ${MAX_QUESTION_CHARS} characters or less`); return }
    if (!domain) { toast.error('Please pick a domain'); return }
    if (!season) { toast.error('Please pick a season'); return }
    if (!cropType.trim()) { toast.error('Please enter the crop type'); return }
    if (atLimit) { toast.error('You have reached the daily submission limit'); return }
    if (!user?.state || !user?.district) { toast.error('Your profile is missing location info — please update it.'); return }

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
      setSubmitted(true)
      questionApi.getMyStats()
        .then((s) => setStats({ remainingToday: (s as any).remainingToday ?? 20, dailyLimit: (s as any).dailyLimit ?? 20 }))
        .catch(() => { })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not submit your question.'))
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
            <h2 className="text-xl font-bold text-foreground">Question submitted!</h2>
            <p className="mt-2 text-sm text-text-secondary max-w-sm">An expert will review your question and post an answer soon. We'll notify you when it's ready.</p>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" onClick={() => { setSubmitted(false); setQuestionText(''); setDomain(''); setSeason(''); setCropType('') }}>Ask another</Button>
              <Button onClick={() => navigate('/public/questions')}>My questions</Button>
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
                <h3 className="text-sm font-bold text-foreground">Similar question found</h3>
                <p className="text-xs text-text-secondary mt-1">Looks like this has been asked before. Here's what we found:</p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4 dark:bg-surface">
              <p className="text-sm font-semibold text-foreground">{duplicate.matchedQuestion}</p>
              {duplicate.matchedAnswer && (
                <div className="mt-3 border-t border-amber-100 pt-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-700">Expert answer</p>
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{duplicate.matchedAnswer}</p>
                </div>
              )}
              {duplicate.matchedUserName && <p className="mt-3 text-xs text-text-tertiary">— Answered by {duplicate.matchedUserName}</p>}
            </div>
            <div className="mt-5 flex gap-3">
              <Button variant="outline" onClick={() => { setDuplicate(null); setQuestionText('') }}>Ask anyway</Button>
              <Button onClick={() => navigate('/public')}>Back home</Button>
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
          <ArrowLeft className="h-4 w-4" />Back
        </Button>
        <div className="text-xs text-text-tertiary">
          {stats ? (
            <span className={atLimit ? 'text-rose-600 font-semibold' : 'text-emerald-700 font-medium'}>
              {atLimit ? 'Daily limit reached' : `${stats.remainingToday}/${stats.dailyLimit} remaining today`}
            </span>
          ) : '…'}
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">Ask a question</h2>
        <p className="text-sm text-text-secondary mt-0.5">An expert will get back to you with an answer.</p>
      </div>
      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="q">Your question <span className="text-rose-600">*</span></Label>
              <Textarea id="q" placeholder="e.g. My tomato leaves are turning yellow — what should I do?" value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={4} maxLength={MAX_QUESTION_CHARS} className="resize-none" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary">Be specific — include crop, location, and what you've already tried.</span>
                <span className={questionText.length > MAX_QUESTION_CHARS - 50 ? 'text-amber-600 font-semibold' : 'text-text-tertiary'}>{questionText.length}/{MAX_QUESTION_CHARS}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Domain <span className="text-rose-600">*</span></Label>
                <Select value={domain} onValueChange={setDomain}>
                  <SelectTrigger><SelectValue placeholder="Pick a domain" /></SelectTrigger>
                  <SelectContent>
                    {DOMAINS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Season <span className="text-rose-600">*</span></Label>
                <Select value={season} onValueChange={setSeason}>
                  <SelectTrigger><SelectValue placeholder="Pick a season" /></SelectTrigger>
                  <SelectContent>
                    {SEASONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crop">Crop type <span className="text-rose-600">*</span></Label>
              <input id="crop" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500" placeholder="e.g. Tomato, Rice, Cotton" value={cropType} onChange={(e) => setCropType(e.target.value)} />
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
              <p className="flex items-start gap-1.5"><Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />Tip: include clear photos if you can — they help experts answer faster. (Image upload coming soon to the web.)</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
              <Button type="submit" disabled={submitting || atLimit || !questionText.trim() || !domain || !season || !cropType.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit question
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}