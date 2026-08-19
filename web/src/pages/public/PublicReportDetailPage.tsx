/**
 * Public Report Detail Page — read-only view of a single report belonging to
 * the authenticated public user. Mirrors mobile/src/screens/Report/ReportDetailScreen.tsx
 * (minus the admin reply box, since users cannot reply to their own reports —
 * the backend restricts POST /reports/:id/replies to ADMIN/SUPER_ADMIN/CURATOR/FINANCE).
 *
 * Layout:
 *   1. Back button + page title
 *   2. Header card ─── category pill, status pill, title, submitted-on date
 *   3. Description card
 *   4. Reply thread (admin replies only — read-only) — or a "no replies yet" hint
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { reportsApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Flag, Loader2, MessageSquareText, AlertCircle } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import type { Report, ReportCategory } from '@/types'

// ─── Category labels (mirrors PublicReportsPage) ────────────────────────────

const CATEGORY_LABELS: Record<ReportCategory | string, string> = {
  bug:             'Bug Report',
  payout_issue:    'Payout Issue',
  question_issue:  'Question Issue',
  abuse:           'Abuse / Harassment',
  feature_request: 'Feature Request',
  other:           'Other',
}

// ─── Status pill config ─────────────────────────────────────────────────────

interface StatusConfig {
  label: string
  classes: string
  dotBg: string
}
const STATUS_CONFIG: Record<string, StatusConfig> = {
  open:        { label: 'Open',        dotBg: 'bg-blue-500',    classes: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50' },
  in_progress: { label: 'In Progress', dotBg: 'bg-amber-500',   classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50' },
  resolved:    { label: 'Resolved',    dotBg: 'bg-emerald-500', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50' },
  closed:      { label: 'Closed',      dotBg: 'bg-slate-400',   classes: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700' },
}

function statusFor(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.closed
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function PublicReportDetailPage(): ReactNode {
  const navigate = useNavigate()
  const { reportId } = useParams<{ reportId: string }>()

  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!reportId) return
    setLoading(true)
    try {
      const data = await reportsApi.getMy(reportId)
      setReport(data)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load report'))
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    fetch()
  }, [fetch])

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl pb-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-text-tertiary">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-xs sm:text-xs sm:text-sm font-medium">Loading report…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 pb-4">
        <Button variant="outline" onClick={() => navigate('/home/reports')}>
          <ArrowLeft className="h-4 w-4" />
          Back to reports
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="mt-4 text-xs sm:text-xs sm:text-sm font-medium text-foreground">Report not found</p>
            <p className="mt-1 text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">
              It may have been removed or you no longer have access.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusCfg = statusFor(report.status)
  const replies = report.replies ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-4">
      {/* Back button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/home/reports')}
        className="rounded-full"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to reports
      </Button>

      {/* Header card */}
      <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/50">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              <Flag className="h-3 w-3" />
              {CATEGORY_LABELS[report.category] ?? report.category}
            </span>
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold',
              statusCfg.classes,
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', statusCfg.dotBg)} aria-hidden />
              {statusCfg.label}
            </span>
            <span className="ml-auto text-[11px] font-medium text-text-tertiary">
              Submitted {formatDateTime(report.createdAt)}
            </span>
          </div>

          <h1 className="text-lg sm:text-lg sm:text-xl font-extrabold leading-tight text-foreground">
            {report.title}
          </h1>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <h2 className="text-[11px] sm:text-[11px] sm:text-xs font-bold uppercase tracking-wide text-text-secondary">
            Description
          </h2>
          <p className="whitespace-pre-wrap text-xs sm:text-xs sm:text-sm leading-relaxed text-foreground">
            {report.description}
          </p>
        </CardContent>
      </Card>

      {/* Reply thread (read-only — users cannot reply) */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] sm:text-[11px] sm:text-xs font-bold uppercase tracking-wide text-text-secondary">
              Replies
            </h2>
            <span className="rounded-full bg-surface-variant px-2 py-0.5 text-[11px] font-bold text-text-secondary">
              {replies.length}
            </span>
          </div>

          {replies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-subtle py-8 text-center">
              <MessageSquareText className="h-7 w-7 text-text-tertiary" />
              <p className="mt-2 text-xs sm:text-xs sm:text-sm font-medium text-foreground">No replies yet</p>
              <p className="mt-1 text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">
                We&rsquo;ll respond soon.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {replies.map((reply) => (
                <li
                  key={reply.id}
                  className="rounded-lg border border-border-subtle bg-surface-variant/40 p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] sm:text-[11px] sm:text-xs font-bold text-primary-foreground">
                      {(reply.admin?.name ?? 'A').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground">
                          {reply.admin?.name ?? 'Admin'}
                        </span>
                        <span className="text-[11px] text-text-tertiary">
                          {formatDateTime(reply.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs sm:text-xs sm:text-sm leading-relaxed text-text">
                        {reply.message}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="pt-2 text-center text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">
        AnnaDatha &mdash; Made for Indian farmers
      </p>
    </div>
  )
}

export default PublicReportDetailPage
