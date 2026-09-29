import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Keyboard, MapPin, Mic, MessageSquareText, Phone, Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubmissionsPagination } from '@/components/submissions/SubmissionsPagination'
import { feedbackApi, getErrorMessage } from '@/api/client'
import { cn, formatDateTime } from '@/lib/utils'
import type { AppFeedbackItem, AppFeedbackListResponse, FeedbackRatingSummary } from '@/types'

const PAGE_SIZE = 20
const STAR_VALUES = [5, 4, 3, 2, 1] as const
type InputFilter = 'all' | 'text' | 'voice'
type LoadState = 'loading' | 'ready' | 'error'

// Row of five stars with the given number filled; the text alternative carries the value.
function StarRating({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const iconClass = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn(iconClass, star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-border')}
        />
      ))}
    </span>
  )
}

/** Admin page listing the app feedback Anveshan users give after reaching 100%. */
export function FeedbacksPage() {
  const [data, setData] = useState<AppFeedbackListResponse | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)
  const [inputFilter, setInputFilter] = useState<InputFilter>('all')

  // Loads one page of feedback for the current filters.
  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const result = await feedbackApi.listAnveshanFeedback({
        page,
        limit: PAGE_SIZE,
        rating: ratingFilter ?? undefined,
        inputMethod: inputFilter === 'all' ? undefined : inputFilter,
      })
      setData(result)
      setLoadState('ready')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load feedback.'))
      setLoadState('error')
    }
  }, [page, ratingFilter, inputFilter])

  useEffect(() => {
    void load()
  }, [load])

  const changeRating = (rating: number | null) => {
    setRatingFilter(rating)
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground sm:text-xl">App Feedback</h2>
        <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
          Ratings and comments Anveshan users shared after reaching 100% of their milestone
        </p>
      </div>

      {data && <FeedbackSummary summary={data.summary} activeRating={ratingFilter} onSelectRating={changeRating} />}

      {/* Filters */}
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Select value={ratingFilter ? String(ratingFilter) : 'all'} onValueChange={(v) => changeRating(v === 'all' ? null : Number(v))}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filter by rating">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ratings</SelectItem>
              {STAR_VALUES.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value} {value === 1 ? 'star' : 'stars'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={inputFilter}
            onValueChange={(v) => {
              setInputFilter(v as InputFilter)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label="Filter by how the comment was given">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Spoken and typed</SelectItem>
              <SelectItem value="voice">Spoken (microphone)</SelectItem>
              <SelectItem value="text">Typed</SelectItem>
            </SelectContent>
          </Select>
          {data && (
            <p className="text-xs text-muted-foreground sm:ml-auto" aria-live="polite">
              {data.total} {data.total === 1 ? 'response' : 'responses'}
            </p>
          )}
        </div>
      </Card>

      {loadState === 'loading' && <FeedbackListSkeleton />}

      {loadState === 'error' && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
            <p className="text-sm text-foreground">{error}</p>
            <Button variant="outline" onClick={() => void load()}>Try again</Button>
          </CardContent>
        </Card>
      )}

      {loadState === 'ready' && data && data.items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <MessageSquareText className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">No feedback found</p>
            <p className="text-xs text-muted-foreground">
              {ratingFilter || inputFilter !== 'all'
                ? 'Try clearing the filters.'
                : 'Feedback appears here once Anveshan users reach 100% and share it.'}
            </p>
          </CardContent>
        </Card>
      )}

      {loadState === 'ready' && data && data.items.length > 0 && (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {data.items.map((item) => (
              <FeedbackCard key={item.id} item={item} />
            ))}
          </ul>
          <SubmissionsPagination page={page} limit={PAGE_SIZE} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}

interface FeedbackSummaryProps {
  summary: FeedbackRatingSummary
  activeRating: number | null
  onSelectRating: (rating: number | null) => void
}

// Average rating, total count and a clickable star breakdown that filters the list.
function FeedbackSummary({ summary, activeRating, onSelectRating }: FeedbackSummaryProps) {
  const max = Math.max(1, ...STAR_VALUES.map((value) => summary.distribution[value]))

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card>
        <CardContent className="flex h-full flex-col items-center justify-center gap-1.5 p-5 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average rating</p>
          <p className="text-4xl font-extrabold tabular-nums text-foreground">
            {summary.averageRating != null ? summary.averageRating.toFixed(1) : '—'}
          </p>
          <StarRating value={summary.averageRating ?? 0} size="lg" />
          <p className="text-xs text-muted-foreground">
            from {summary.total} {summary.total === 1 ? 'response' : 'responses'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1.5 p-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Rating breakdown</p>
          {STAR_VALUES.map((value) => {
            const count = summary.distribution[value]
            const active = activeRating === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => onSelectRating(active ? null : value)}
                aria-pressed={active}
                aria-label={`${value} stars: ${count} responses. ${active ? 'Clear filter' : 'Show only these'}`}
                className={cn(
                  'grid w-full grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 rounded-md px-2 py-1 text-left text-xs transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  active ? 'bg-amber-500/15' : 'hover:bg-muted',
                )}
              >
                <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                  {value} <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${(count / max) * 100}%` }} />
                </span>
                <span className="text-right tabular-nums text-muted-foreground">{count}</span>
              </button>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

// One feedback: who sent it, the stars, how the comment was given and the comment itself.
function FeedbackCard({ item }: { item: AppFeedbackItem }) {
  const location = [item.user?.district, item.user?.state].filter(Boolean).join(', ')
  return (
    <li>
      <Card className="h-full">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{item.user?.name || 'Unknown user'}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {item.user?.mobileNumber && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" aria-hidden="true" /> {item.user.mobileNumber}
                  </span>
                )}
                {location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden="true" /> {location}
                  </span>
                )}
              </div>
            </div>
            <StarRating value={item.rating} />
          </div>

          {item.comment ? (
            <p className="flex-1 whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm text-foreground">{item.comment}</p>
          ) : (
            <p className="flex-1 text-sm italic text-muted-foreground">No comment, rating only</p>
          )}

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {item.inputMethod === 'voice' ? (
                <>
                  <Mic className="h-3.5 w-3.5" aria-hidden="true" /> Spoken
                </>
              ) : (
                <>
                  <Keyboard className="h-3.5 w-3.5" aria-hidden="true" /> Typed
                </>
              )}
            </span>
            <span>{formatDateTime(item.createdAt)}</span>
          </div>
        </CardContent>
      </Card>
    </li>
  )
}

function FeedbackListSkeleton() {
  return (
    <ul className="grid gap-3 md:grid-cols-2" aria-busy="true" aria-label="Loading feedback">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i}>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-16 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
