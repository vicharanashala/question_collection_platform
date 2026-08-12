import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { questionApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, MessageSquarePlus, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Question } from '@/types'

const STATUS_TABS: { key: '' | 'pending' | 'approved' | 'rejected' | 'held' | 'moved_to_final'; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'held', label: 'On hold' },
  { key: 'moved_to_final', label: 'Published' },
]

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-blue-100 text-blue-700',
    rejected: 'bg-rose-100 text-rose-700',
    held: 'bg-violet-100 text-violet-700',
    moved_to_final: 'bg-emerald-100 text-emerald-700',
  }
  return map[s] ?? 'bg-muted text-muted-foreground'
}

function formatDate(s: string) {
  try {
    const d = new Date(s)
    const now = new Date()
    const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
    if (diffH < 1) return 'just now'
    if (diffH < 24) return `${diffH}h ago`
    const days = Math.floor(diffH / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch { return s }
}

export function PublicQuestionsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<typeof STATUS_TABS[number]['key']>('')
  const [page, setPage] = useState(1)
  const limit = 20
  const [total, setTotal] = useState(0)

  async function load() {
    setLoading(true)
    try {
      const res = await questionApi.listMyQuestions({ status: status || undefined, page, limit })
      setItems(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load your questions.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status, page])

  const pages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Submissions</h2>
          <p className="mt-0.5 text-sm text-text-secondary">Your submitted questions and their status.</p>
        </div>
        <Button onClick={() => navigate('/public/ask')} className="bg-emerald-500 hover:bg-emerald-600">
          <MessageSquarePlus className="h-4 w-4" />Ask
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map((s) => (
          <button key={s.key || 'all'} type="button" onClick={() => { setStatus(s.key); setPage(1) }} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', status === s.key ? 'bg-emerald-500 text-white' : 'border border-border-subtle bg-surface text-text-secondary hover:border-emerald-300')}>
            {s.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-text-secondary">No questions found</p>
              <Button onClick={() => navigate('/public/ask')} className="mt-3 bg-emerald-500 hover:bg-emerald-600">
                <MessageSquarePlus className="h-4 w-4" /> Ask your first question
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {items.map((q) => (
                <li key={q.id} className="p-4 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors cursor-pointer" onClick={() => q.id && navigate(`/public/questions/${q.id}`)}>
                  <div className="flex items-start gap-3">
                    {q.mediaUrls && q.mediaUrls.length > 0 && <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium text-foreground">{q.questionText}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-text-tertiary">
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', statusBadge(q.status))}>{q.status.replace(/_/g, ' ')}</span>
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
          <span>Showing {start}–{end} of {total}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-7 px-2">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-foreground">Page {page} / {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-7 px-2">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}