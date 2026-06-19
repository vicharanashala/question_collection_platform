import { useState, useEffect, useMemo } from 'react'
import { questionApi, getErrorMessage } from '@/api/client'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatDate } from '@/lib/utils'
import {
  Clock, User, Eye, Star,
  MapPin, Wheat, CloudRain, Globe, Film,
  Hash, AlertTriangle, PauseCircle, CheckCircle,
  XCircle, ListFilter, Search, Info,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types'
import { TranslatableText } from '@/components/TranslatableText'
import {
  DataTable, CardView,
  ViewToggle, DualView,
  type ColumnDef,
} from '@/components/DataTable'

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:      'bg-warning text-white',
  ai_review:    'bg-blue-500 text-white',
  human_review: 'bg-purple-500 text-white',
  held:         'bg-[hsl(38,92%,50%)] text-white',
  approved:     'bg-success text-white',
  rejected:     'bg-destructive text-white',
}

const STATUS_LABELS: Record<string, string> = {
  pending:      'Pending',
  ai_review:    'AI Review',
  human_review: 'Human Review',
  held:         'Held',
  approved:     'Approved',
  rejected:     'Rejected',
}

const SEASON_LABEL: Record<string, string> = {
  Kharif: 'Kharif',
  Rabi: 'Rabi',
  Zaid: 'Zaid',
  'Pre-Kharif': 'Pre-Kharif',
  'Post-Kharif': 'Post-Kharif',
  'Pre-Rabi': 'Pre-Rabi',
  'Zaid Rabi': 'Zaid Rabi',
  Spring: 'Spring',
  Summer: 'Summer',
  Autumn: 'Autumn',
  Winter: 'Winter',
  Monsoon: 'Monsoon',
  'Dry Season': 'Dry Season',
  'Wet Season': 'Wet Season',
};

// ─── Detail dialog InfoRow helper ────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground min-w-[110px]">{label}</span>
      <span className="text-sm text-foreground font-medium">{value}</span>
    </div>
  )
}



// ─── Questions page ───────────────────────────────────────────────────────────

export function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'held' | 'approved' | 'rejected' | 'pending' | 'ai_review' | 'human_review' | ''>('')
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<'table' | 'card'>('table')
  const limit = 10
  const cardLimit = 9
  const debouncedSearch = useDebouncedValue(search, 400)

  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [apiTotal, setApiTotal] = useState(0)
  const [langByQuestionId, setLangByQuestionId] = useState<Record<string, string>>({})



  const getLang = (id: string) => langByQuestionId[id] ?? ''
  const setLang = (id: string, lang: string) => setLangByQuestionId((prev) => ({ ...prev, [id]: lang }))

  // Client-side sort — newest first
  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => a.submittedAt < b.submittedAt ? 1 : -1)
  }, [questions])

  useEffect(() => { setPage(1) }, [debouncedSearch, statusFilter])

  useEffect(() => {
    setLoading(true)
    const activeLimit = view === 'card' ? cardLimit : limit
    questionApi.getQuestions({ page, limit: activeLimit, search: debouncedSearch || undefined, status: statusFilter || undefined })
      .then((res) => {
        setQuestions(res.items as Question[])
        setApiTotal(res.total)
      })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load questions')))
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, statusFilter, view])

  const totalPages = Math.max(1, Math.ceil(apiTotal / (view === 'card' ? cardLimit : limit)))

  // ─── Table columns ─────────────────────────────────────────────────────────
  const columns: ColumnDef<Question>[] = [
    {
      key: 'status', header: 'Status', width: '110px', sortable: true,
      render: (q) => (
        <Badge className={cn('capitalize text-xs px-2 py-0.5 whitespace-nowrap', STATUS_COLORS[q.status] ?? 'bg-muted')}>
          {STATUS_LABELS[q.status] ?? q.status}
        </Badge>
      ),
    },
    {
      key: 'questionText', header: 'Question', width: '280px', sortable: false,
      render: (q) => (
        <span className="line-clamp-2 text-xs">{q.questionText}</span>
      ),
    },
    {
      key: 'submittedBy', header: 'Submitted By', width: '130px', sortable: true,
      render: (q) => (
        <span className="text-xs truncate block" title={q.user?.name ?? q.userName ?? q.userMobileNumber ?? ''}>
          {q.user?.name ?? q.userName ?? q.userMobileNumber ?? '—'}
        </span>
      ),
    },
    {
      key: 'domains', header: 'Category', width: '180px', sortable: true,
      render: (q) => (
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">
          {(q.domains ?? []).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'cropType', header: 'Crop', width: '100px', sortable: true,
      render: (q) => (
        <span className="text-xs capitalize">{q.cropType ?? '—'}</span>
      ),
    },
    {
      key: 'season', header: 'Season', width: '90px', sortable: true,
      render: (q) => (
        <span className="text-xs capitalize">{SEASON_LABEL[q.season] ?? q.season ?? '—'}</span>
      ),
    },
    {
      key: 'location', header: 'Location', width: '140px', sortable: true,
      render: (q) => (
        <span className="text-xs truncate block" title={[q.district, q.state].filter(Boolean).join(', ')}>
          {[q.district, q.state].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'aiConfidenceScore', header: 'AI Score', width: '90px', sortable: true,
      render: (q) => q.aiConfidenceScore != null ? (
        <span className={cn('text-xs font-medium', q.aiConfidenceScore >= 80 ? 'text-success' : q.aiConfidenceScore >= 50 ? 'text-warning' : 'text-destructive')}>
          {q.aiConfidenceScore}%
        </span>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'submittedAt', header: 'Submitted', width: '120px', sortable: true,
      render: (q) => <span className="text-xs text-muted-foreground">{formatDate(q.submittedAt)}</span>,
    },
    {
      key: 'reviewedByName', header: 'Reviewed By', width: '120px', sortable: true,
      render: (q) => <span className="text-xs truncate block">{q.reviewedByName ?? '—'}</span>,
    },
    {
      key: 'mediaCount', header: 'Media', width: '70px', sortable: false,
      render: (q) => q.mediaUrls && q.mediaUrls.length > 0 ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Film className="h-3 w-3" />{q.mediaUrls.length}</span>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
  ]

  const emptyMessage = search || statusFilter ? 'No questions match your filters' : 'No questions yet'

  // ─── Card view ─────────────────────────────────────────────────────────────
  const tableComponent = (
    <DataTable
      data={sortedQuestions}
      columns={columns}
      loading={loading}
      page={page}
      totalPages={totalPages}
      totalCount={apiTotal}
      hideSearch
      onPageChange={setPage}
      SkeletonRows={5}
      emptyMessage={emptyMessage}
      onRowClick={(row) => {
        setDetailQuestion(row as Question)
        setDetailOpen(true)
      }}
    />
  )

  const cardComponent = (
    <CardView
      data={sortedQuestions}
      columns={columns}
      loading={loading}
      page={page}
      totalPages={totalPages}
      totalCount={apiTotal}
      onPageChange={setPage}
      SkeletonRows={6}
      emptyMessage={emptyMessage}
      onRowClick={(row) => {
        setDetailQuestion(row as Question)
        setDetailOpen(true)
      }}
    />
  )

  // ─── Status filter chips ───────────────────────────────────────────────────
  const statusOptions: { value: 'held' | 'approved' | 'rejected' | 'pending' | 'ai_review' | 'human_review' | ''; label: string }[] = [
    { value: '',             label: 'All' },
    { value: 'pending',      label: 'Pending' },
    { value: 'ai_review',    label: 'AI Review' },
    { value: 'human_review', label: 'Human Review' },
    { value: 'held',         label: 'Held' },
    { value: 'approved',     label: 'Approved' },
    { value: 'rejected',     label: 'Rejected' },
  ]

  return (
    <div className="space-y-5">
      {/* ─── Page header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Questions</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            All submitted questions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {apiTotal > 0 && (
            <span className="text-xs text-muted-foreground hidden sm:block">{apiTotal.toLocaleString()} total</span>
          )}
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* ─── Filter bar ─── */}
      <Card>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4">
          {/* Status filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <ListFilter className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {statusOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => { setStatusFilter(value); setPage(1) }}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150',
                    statusFilter === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border-subtle bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:max-w-xs ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search crop, keyword, location..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      {/* ─── Dual view ─── */}
      <DualView
        view={view}
        tableComponent={tableComponent}
        cardComponent={cardComponent}
      />

      {/* ─── Question detail dialog ─── */}
      {detailQuestion && (
        <Dialog open={detailOpen} onOpenChange={(open) => { if (!open) { setDetailOpen(false); setDetailQuestion(null) } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-4 w-4" /> Question Details
              </DialogTitle>
              <DialogDescription>Full information for the selected question.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn('capitalize text-xs px-2 py-0.5', STATUS_COLORS[detailQuestion.status] ?? 'bg-muted')}>
                  {STATUS_LABELS[detailQuestion.status] ?? detailQuestion.status}
                </Badge>
                {detailQuestion.domains?.length ? (
                  <span className="text-xs text-muted-foreground capitalize">{detailQuestion.domains.join(', ')}</span>
                ) : null}
                {detailQuestion.aiConfidenceScore != null && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 text-warning" /> AI confidence: {detailQuestion.aiConfidenceScore}%
                  </span>
                )}
                {detailQuestion.duplicateFlag && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Duplicate
                  </Badge>
                )}
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <TranslatableText
                  text={detailQuestion.questionText}
                  selectedLang={getLang(detailQuestion.id)}
                  onLangChange={(lang) => setLang(detailQuestion.id, lang)}
                  sourceLanguage={detailQuestion.language ?? 'en'}
                  inline
                />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <InfoRow icon={Hash} label="Question ID" value={<span className="font-mono text-xs">{detailQuestion.id.slice(0, 8)}…</span>} />
                <InfoRow icon={Globe} label="Language" value={detailQuestion.language?.toUpperCase()} />
                <InfoRow icon={Info} label="Category" value={(detailQuestion.domains ?? []).join(', ') || '—'} />
                <InfoRow icon={Wheat} label="Crop Type" value={detailQuestion.cropType} />
                <InfoRow icon={CloudRain} label="Season" value={SEASON_LABEL[detailQuestion.season] ?? detailQuestion.season} />
                <InfoRow icon={MapPin} label="State" value={detailQuestion.state} />
                <InfoRow icon={MapPin} label="District" value={detailQuestion.district} />
                {detailQuestion.block && <InfoRow icon={MapPin} label="Block" value={detailQuestion.block} />}
                <InfoRow icon={User} label="Submitted By" value={detailQuestion.user?.name ?? detailQuestion.userName ?? '—'} />
                <InfoRow icon={Clock} label="Submitted" value={formatDate(detailQuestion.submittedAt)} />
                {detailQuestion.reviewedAt && <InfoRow icon={Clock} label="Reviewed" value={formatDate(detailQuestion.reviewedAt)} />}
                {detailQuestion.reviewedByName && <InfoRow icon={User} label="Reviewed By" value={detailQuestion.reviewedByName} />}
                {detailQuestion.rejectionReason && <div className="col-span-2 mt-1"><InfoRow icon={XCircle} label="Rejection Reason" value={detailQuestion.rejectionReason} /></div>}
                {detailQuestion.approvalReason && <div className="col-span-2 mt-1"><InfoRow icon={CheckCircle} label="Approval Reason" value={detailQuestion.approvalReason} /></div>}
                {detailQuestion.heldReason && <div className="col-span-2 mt-1"><InfoRow icon={PauseCircle} label="Hold Reason" value={detailQuestion.heldReason} /></div>}
              </div>
              {detailQuestion.mediaUrls && detailQuestion.mediaUrls.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2 text-sm text-muted-foreground"><Film className="h-4 w-4" />Media ({detailQuestion.mediaUrls.length})</div>
                  <div className="grid grid-cols-3 gap-2">
                    {detailQuestion.mediaUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`media-${i}`} className="rounded-md border w-full h-24 object-cover hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}