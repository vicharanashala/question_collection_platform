import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { questionApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, MessageSquarePlus, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Question } from '@/types'

const STATUS_TABS: { key: '' | 'pending' | 'approved' | 'rejected' | 'held' | 'moved_to_final'; labelKey: string }[] = [
  { key: '', labelKey: 'submissions.allStatus' },
  { key: 'pending', labelKey: 'submissions.pending' },
  { key: 'approved', labelKey: 'submissions.approved' },
  { key: 'rejected', labelKey: 'submissions.rejected' },
  { key: 'held', labelKey: 'submissions.held' },
  { key: 'moved_to_final', labelKey: 'submissions.published' },
]

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-blue-100 text-blue-700',
    rejected: 'bg-rose-100 text-rose-700',
    held: 'bg-violet-100 text-violet-700',
    moved_to_final: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  }
  return map[s] ?? 'bg-muted text-muted-foreground'
}

/** Map API status (pending/approved/rejected/held/moved_to_final) → i18n key. */
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

export function PublicQuestionsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [items, setItems] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<typeof STATUS_TABS[number]['key']>('')
  const [page, setPage] = useState(1)
  const limit = 20
  const [total, setTotal] = useState(0)

  /** Format an ISO timestamp as a localised relative-time string. */
  function formatDate(s: string) {
    try {
      const d = new Date(s)
      const now = new Date()
      const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
      if (diffH < 1) return t('common.justNow')
      if (diffH < 24) return t('common.hoursAgo', { count: diffH })
      const days = Math.floor(diffH / 24)
      if (days < 7) return t('common.daysAgo', { count: days })
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch { return s }
  }

  async function load() {
    setLoading(true)
    try {
      const res = await questionApi.listMyQuestions({ status: status || undefined, page, limit })
      setItems(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      toast.error(getErrorMessage(err, t('submissions.loadError')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status, page])

  const pages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground lg:text-2xl">{t('submissions.title')}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{t('submissions.yourSubmissions')}</p>
        </div>
        <Button onClick={() => navigate('/public/ask')} className="bg-emerald-500 hover:bg-emerald-600">
          <MessageSquarePlus className="h-4 w-4" />{t('question.askQuestion')}
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((s) => (
          <button key={s.key || 'all'} type="button" onClick={() => { setStatus(s.key); setPage(1) }} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', status === s.key ? 'bg-primary text-primary-foreground' : 'border border-border-subtle bg-surface text-text-secondary hover:border-primary/40 dark:hover:border-primary/60')}>
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-text-secondary">{t('common.noQuestionsFound')}</p>
              <Button onClick={() => navigate('/public/ask')} className="mt-3 bg-emerald-500 hover:bg-emerald-600">
                <MessageSquarePlus className="h-4 w-4" /> {t('common.askYourFirstQuestion')}
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {items.map((q) => (
                <li key={q.id} className="p-4 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors cursor-pointer lg:p-5" onClick={() => q.id && navigate(`/public/questions/${q.id}`)}>
                  <div className="flex items-start gap-3">
                    {q.mediaUrls && q.mediaUrls.length > 0 && <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />}
                    {/* Text + meta stack on mobile; on desktop the meta (status/
                        date/crop) moves beside the text instead of below it,
                        so a short question isn't left with empty space to its
                        right on a wide row. */}
                    <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                      <p className="line-clamp-2 flex-1 text-sm font-medium text-foreground lg:line-clamp-1 lg:text-base">{q.questionText}</p>
                      <div className="flex shrink-0 items-center gap-2 text-xs text-text-tertiary">
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', statusBadge(q.status))}>{t(statusLabelKey(q.status))}</span>
                        <span>·</span>
                        <span>{formatDate(q.submittedAt)}</span>
                        {q.cropType && <><span>·</span><span>{q.cropType}</span></>}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!loading && items.length > 0 && (
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>{t('common.showing', { start, end, total })}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-7 px-2">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-foreground">{t('common.pageX', { page, total: pages })}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-7 px-2">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}