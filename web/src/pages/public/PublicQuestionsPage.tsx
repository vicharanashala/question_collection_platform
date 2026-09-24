import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { questionApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, MessageSquarePlus, Image as ImageIcon, Flag } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { QuestionDetailModal } from '@/components/submissions/QuestionDetailModal'
import { SubmissionStatusFilter } from '@/components/submissions/SubmissionStatusFilter'
import { SubmissionsPagination } from '@/components/submissions/SubmissionsPagination'
import { useRelativeTime } from '@/components/submissions/useRelativeTime'
import { SubmissionTypeTabs, parseSubmissionTab, type SubmissionTab } from '@/components/agri-entity/SubmissionTypeTabs'
import { AgriEntitySubmissionsList } from '@/components/agri-entity/AgriEntitySubmissionsList'
import { AGRI_ENTITY_TYPES } from '@/constants/public'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = parseSubmissionTab(searchParams.get('tab'))
  const typeLabel = activeTab === 'question'
    ? ''
    : t(`agriEntity.tabs.${activeTab}`, AGRI_ENTITY_TYPES.find((type) => type.value === activeTab)?.label ?? '')

  // Keeps the selected tab in the URL so it survives refresh and can be linked to.
  function handleTabChange(tab: SubmissionTab) {
    setSearchParams(tab === 'question' ? {} : { tab }, { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">{t('submissions.title')}</h2>
          <p className="mt-0.5 text-xs sm:text-sm text-text-secondary">{t('submissions.yourSubmissions')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/home/reports')}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/50"
            aria-label={t('report.title', 'Report an Issue')}
          >
            <Flag className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline-block">{t('report.title', 'Report an Issue')}</span>
          </Button>
          {activeTab === 'question' ? (
            <Button onClick={() => navigate('/home/ask')} className="bg-emerald-500 hover:bg-emerald-600 shrink-0" aria-label={t('question.askQuestion')}>
              <MessageSquarePlus className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">{t('question.askQuestion')}</span>
            </Button>
          ) : (
            <Button
              onClick={() => navigate(`/home/ask?tab=${activeTab}`)}
              className="bg-emerald-500 hover:bg-emerald-600 shrink-0"
              aria-label={t('agriEntity.submit', { type: typeLabel, defaultValue: 'Submit {{type}}' })}
            >
              <MessageSquarePlus className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">{t('agriEntity.submit', { type: typeLabel, defaultValue: 'Submit {{type}}' })}</span>
            </Button>
          )}
        </div>
      </div>

      <SubmissionTypeTabs value={activeTab} onChange={handleTabChange} />

      {activeTab === 'question' ? (
        <QuestionSubmissions />
      ) : (
        <AgriEntitySubmissionsList key={activeTab} type={activeTab} typeLabel={typeLabel} />
      )}
    </div>
  )
}

/** The signed-in user's questions, filterable by review status. */
function QuestionSubmissions() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const formatDate = useRelativeTime()
  const [items, setItems] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<typeof STATUS_TABS[number]['key']>('')
  const [page, setPage] = useState(1)
  const limit = 20
  const [total, setTotal] = useState(0)
  // Selected question for the read-only detail dialog — null when closed.
  // Kept as `id` (not the full object) so the modal owns its own fetch / cache
  // and we never have to keep two copies of the question in sync.
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null)

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

  return (
    <>
      <SubmissionStatusFilter
        options={STATUS_TABS.map((s) => ({ key: s.key, label: t(s.labelKey) }))}
        value={status}
        onChange={(s) => { setStatus(s); setPage(1) }}
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>
          ) : items.length === 0 ? (
            <div className="p-8 sm:p-10 text-center">
              <p className="text-xs sm:text-sm font-medium text-text-secondary">{t('common.noQuestionsFound')}</p>
              <Button onClick={() => navigate('/home/ask')} className="mt-3 bg-emerald-500 hover:bg-emerald-600">
                <MessageSquarePlus className="h-4 w-4" /> {t('common.askYourFirstQuestion')}
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {items.map((q) => (
                <li
                  key={q.id}
                  className="p-4 sm:p-5 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors cursor-pointer"
                  onClick={() => q.id && setOpenQuestionId(q.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && q.id) {
                      e.preventDefault()
                      setOpenQuestionId(q.id)
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {q.mediaUrls && q.mediaUrls.length > 0 && <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />}
                    {/* Text + meta stack on mobile; side-by-side on desktop so a short
                        question doesn't leave empty space on a wide row. */}
                    <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
                      <p className="line-clamp-2 flex-1 text-xs sm:text-sm font-medium text-foreground lg:line-clamp-1 lg:text-sm">{q.questionText}</p>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[11px] sm:text-xs text-text-tertiary">
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', statusBadge(q.status))}>{t(statusLabelKey(q.status))}</span>
                        <span>·</span>
                        <span>{formatDate(q.submittedAt)}</span>
                        {q.cropType && <><span>·</span><span className="hidden sm:inline">{q.cropType}</span></>}
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
        <SubmissionsPagination page={page} limit={limit} total={total} onPageChange={setPage} />
      )}

      {/* Read-only detail dialog — opens when a list row is clicked and closes
          when the user dismisses it (X button, Escape, or outside click). The
          dialog fetches its own question via `questionApi.getQuestion`. */}
      <QuestionDetailModal
        open={openQuestionId !== null}
        onOpenChange={(open) => { if (!open) setOpenQuestionId(null) }}
        questionId={openQuestionId}
      />
    </>
  )
}