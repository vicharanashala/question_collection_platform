/**
 * Public Reports Page — mirrors mobile/src/screens/Report/ReportScreen.tsx
 *
 * Layout:
 *   1. Header card ────── "Report an Issue" + "+ New Report" pill (primary action)
 *   2. Empty state ────── centered flag-circle + headline + subtitle + "New Report" CTA
 *      (matches the mobile screenshot exactly)
 *   3. List state ────── Report cards with left status accent bar, category pill,
 *                        date, title, description preview, reply count + status pill.
 *   4. New Report form modal — category grid (2×3 clickable cards), title (≤100),
 *                               description (≤2000), error banner, submit/cancel.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportsApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Plus, Flag, AlertCircle, Bug, CreditCard, HelpCircle,
  ShieldAlert, Lightbulb, MoreHorizontal, Loader2,
  MessageSquareText, CheckCircle2,
} from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { toast } from 'sonner'
import type { Report, ReportCategory } from '@/types'

// ─── Category config (mirrors mobile ReportScreen CATEGORY_OPTIONS) ─────────

interface CategoryOption {
  value: ReportCategory
  label: string
  icon: typeof Bug
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'bug',             label: 'Bug Report',         icon: Bug },
  { value: 'payout_issue',    label: 'Payout Issue',       icon: CreditCard },
  { value: 'question_issue',  label: 'Question Issue',     icon: HelpCircle },
  { value: 'abuse',           label: 'Abuse / Harassment', icon: ShieldAlert },
  { value: 'feature_request', label: 'Feature Request',    icon: Lightbulb },
  { value: 'other',           label: 'Other',              icon: MoreHorizontal },
]

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
)

// ─── Status config (mirrors mobile ReportScreen STATUS_CONFIG) ──────────────

interface StatusConfig {
  color: string // text + dot + accent-bar
  bg: string // pill bg
  label: string
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  open:        { color: 'text-blue-600 dark:text-blue-400',         bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200/70 dark:border-blue-900/40',       label: 'Open' },
  in_progress: { color: 'text-amber-700 dark:text-amber-300',       bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/70 dark:border-amber-900/40', label: 'In Progress' },
  resolved:    { color: 'text-emerald-700 dark:text-emerald-300',   bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/70 dark:border-emerald-900/40', label: 'Resolved' },
  closed:      { color: 'text-slate-600 dark:text-slate-400',       bg: 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700',     label: 'Closed' },
}

function statusFor(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.closed
}

// Map status → solid accent-bar background colour (matches pill dot)
function statusAccentBg(status: string): string {
  switch (status) {
    case 'open':        return 'bg-blue-500'
    case 'in_progress': return 'bg-amber-500'
    case 'resolved':    return 'bg-emerald-500'
    default:            return 'bg-slate-400'
  }
}

// Map category → icon (falls back to Flag for unknown)
function categoryIcon(value: string): typeof Bug {
  return (CATEGORY_OPTIONS.find((o) => o.value === value)?.icon) ?? Flag
}

// ─── Report card (list) ─────────────────────────────────────────────────────

interface ReportCardProps {
  report: Report
  onPress: () => void
}
function ReportCard({ report, onPress }: ReportCardProps) {
  const cfg = statusFor(report.status)
  const Icon = categoryIcon(report.category)
  const date = formatRelativeDate(report.createdAt)
  const replyCount = report.replies?.length ?? 0

  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        'group flex w-full overflow-hidden rounded-xl border border-border-subtle bg-surface text-left shadow-sm',
        'transition-all hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
      )}
    >
      {/* Left accent bar */}
      <div className={cn('w-1 shrink-0', statusAccentBg(report.status))} aria-hidden />

      <div className="flex-1 min-w-0 p-4">
        {/* Row 1: category pill + date */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            <Icon className="h-3 w-3" />
            <span>{CATEGORY_LABELS[report.category] ?? report.category}</span>
          </div>
          <span className="shrink-0 text-[11px] font-medium text-text-tertiary">{date}</span>
        </div>

        {/* Row 2: title */}
        <p className="mt-2 line-clamp-2 text-xs sm:text-xs sm:text-sm font-bold text-foreground">{report.title}</p>

        {/* Row 3: description preview */}
        <p className="mt-1 line-clamp-2 text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">{report.description}</p>

        {/* Row 4: footer */}
        <div className="mt-3 flex items-center justify-between">
          {replyCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <MessageSquareText className="h-3 w-3" />
              {replyCount === 1 ? '1 reply' : `${replyCount} replies`}
            </span>
          ) : (
            <span className="text-[11px] text-text-tertiary">Awaiting reply</span>
          )}

          <span className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold',
            cfg.bg, cfg.color,
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', statusAccentBg(report.status))} aria-hidden />
            {cfg.label}
          </span>
        </div>
      </div>
    </button>
  )
}

// ─── New Report form (controlled dialog) ────────────────────────────────────

interface NewReportFormProps {
  open: boolean
  submitting: boolean
  onCancel: () => void
  onSubmit: (input: { category: string; title: string; description: string }) => void
}

function NewReportForm({ open, submitting, onCancel, onSubmit }: NewReportFormProps) {
  const [category, setCategory] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  // Reset state every time the modal opens
  useEffect(() => {
    if (open) {
      setCategory('')
      setTitle('')
      setDescription('')
      setError('')
    }
  }, [open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = title.trim()
    const d = description.trim()
    if (t.length < 5) { setError('Title must be at least 5 characters'); return }
    if (d.length < 10) { setError('Description must be at least 10 characters'); return }
    if (!category) { setError('Please select a category'); return }
    onSubmit({ category, title: t, description: d })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !submitting) onCancel()
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Report</DialogTitle>
          <DialogDescription>
            Describe the issue you faced. Our team will get back to you soon.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 dark:bg-red-950/40 dark:border-red-900/50 px-3 py-2 text-xs sm:text-xs sm:text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((opt) => {
                const active = category === opt.value
                const Icon = opt.icon
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    disabled={submitting}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs sm:text-xs sm:text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                      active
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-border-subtle bg-surface text-text-secondary hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{opt.label}</span>
                    {active && <CheckCircle2 className="h-4 w-4 ml-auto text-emerald-600 dark:text-emerald-400" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="report-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="report-title"
              placeholder="Brief summary of the issue"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              disabled={submitting}
            />
            <p className="text-right text-[11px] text-text-tertiary">{title.length}/100</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="report-description">Description <span className="text-destructive">*</span></Label>
            <Textarea
              id="report-description"
              placeholder="Describe the issue in detail (min 10 characters)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={2000}
              disabled={submitting}
            />
            <p className="text-right text-[11px] text-text-tertiary">{description.length}/2000</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Submit Report'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function PublicReportsPage(): ReactNode {
  const navigate = useNavigate()

  const [items, setItems] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchMyReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reportsApi.listMy({ page: 1, limit: 50 })
      setItems(res.items ?? [])
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load your reports'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMyReports()
  }, [fetchMyReports])

  async function handleCreateReport(input: { category: string; title: string; description: string }) {
    setSubmitting(true)
    try {
      await reportsApi.create(input)
      toast.success('Report submitted successfully')
      setFormOpen(false)
      // Refresh the list so the user sees their report immediately
      await fetchMyReports()
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to submit report'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      {/* Header card — title + "New Report" pill (matches mobile teal button) */}
      <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/50">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <h1 className="text-lg sm:text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
            Report an Issue
          </h1>
          <Button
            onClick={() => setFormOpen(true)}
            className="rounded-full"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            New Report
          </Button>
        </CardContent>
      </Card>

      {/* Body */}
      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-text-tertiary">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-xs sm:text-xs sm:text-sm font-medium">Loading your reports…</p>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            {/* Empty-state flag circle — matches mobile screenshot */}
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-variant dark:bg-surface-variant">
              <Flag className="h-12 w-12 text-text-tertiary" strokeWidth={1.75} />
            </div>
            <h2 className="mt-5 text-lg sm:text-lg sm:text-xl font-extrabold text-foreground">No Reports Yet</h2>
            <p className="mt-2 max-w-sm text-xs sm:text-xs sm:text-sm text-text-secondary">
              If you encounter an issue, submit a report and we&rsquo;ll get back to you.
            </p>
            <Button onClick={() => setFormOpen(true)} size="lg" className="mt-6">
              <Plus className="h-4 w-4" />
              New Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              onPress={() => navigate(`/home/reports/${r.id}`)}
            />
          ))}
        </div>
      )}

      {/* New Report modal */}
      <NewReportForm
        open={formOpen}
        submitting={submitting}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleCreateReport}
      />

      <p className="pt-2 text-center text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">
        AnnaDatha &mdash; Made for Indian farmers
      </p>
    </div>
  )
}

export default PublicReportsPage
