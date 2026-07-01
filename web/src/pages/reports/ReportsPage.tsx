import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { reportsApi, getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatDateTime } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Eye, Flag } from 'lucide-react'
import { toast } from 'sonner'
import type { Report } from '@/types'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'bug', label: 'Bug' },
  { value: 'payout_issue', label: 'Payout Issue' },
  { value: 'question_issue', label: 'Question Issue' },
  { value: 'abuse', label: 'Abuse' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
]

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const CATEGORY_COLORS: Record<string, string> = {
  bug:              'bg-destructive text-white',
  payout_issue:     'bg-warning text-white',
  question_issue:   'bg-ai_review text-white',
  abuse:            'bg-black text-white',
  feature_request:  'bg-success text-white',
  other:            'bg-surface-variant text-text',
}

const PRIORITY_COLORS: Record<string, string> = {
  low:    'bg-surface-variant text-text',
  medium: 'bg-warning text-white',
  high:   'bg-orange-500 text-white',
  urgent: 'bg-destructive text-white',
}

const STATUS_COLORS: Record<string, string> = {
  open:        'bg-blue-500 text-white',
  in_progress: 'bg-warning text-white',
  resolved:    'bg-success text-white',
  closed:      'bg-surface-variant text-text',
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug',
  payout_issue: 'Payout Issue',
  question_issue: 'Question Issue',
  abuse: 'Abuse',
  feature_request: 'Feature Request',
  other: 'Other',
}

export default function ReportsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Report[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const [updatingPriorityId, setUpdatingPriorityId] = useState<string | null>(null)

  const handlePriorityChange = async (reportId: string, priority: string) => {
    setUpdatingPriorityId(reportId)
    try {
      await reportsApi.updatePriority(reportId, priority)
      setItems((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, priority: priority as Report['priority'] } : r)),
      )
      toast.success('Priority updated')
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to update priority'))
    } finally {
      setUpdatingPriorityId(null)
    }
  }

  const limit = 20

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reportsApi.list({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        priority: priorityFilter || undefined,
        page,
        limit,
      })
      setItems(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load reports'))
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, categoryFilter, priorityFilter])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, categoryFilter, priorityFilter])

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Flag className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Reports</h1>
          <Badge variant="secondary">{total} total</Badge>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface">
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v); setPage(1) }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryFilter}
          onValueChange={(v) => { setCategoryFilter(v); setPage(1) }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={priorityFilter}
          onValueChange={(v) => { setPriorityFilter(v); setPage(1) }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(statusFilter || categoryFilter || priorityFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStatusFilter(''); setCategoryFilter(''); setPriorityFilter('') }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface border-b border-border">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Reporter</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-24 rounded bg-surface-variant animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No reports found
                </td>
              </tr>
            )}

            {items.map((report) => (
              <tr
                key={report.id}
                className="border-b border-border cursor-pointer hover:bg-surface transition-colors"
                onClick={() => navigate(`/reports/${report.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{report.user?.name ?? '—'}</div>
                  <div className="text-xs text-muted-foreground">{report.user?.mobileNumber ?? ''}</div>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <div className="truncate font-medium">{report.title}</div>
                  {report.relatedEntityId && (
                    <div className="text-xs text-muted-foreground">
                      Ref: {report.relatedEntityType} #{report.relatedEntityId.slice(0, 8)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge className={CATEGORY_COLORS[report.category] ?? 'bg-surface-variant text-text'}>
                    {CATEGORY_LABELS[report.category] ?? report.category}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Select
                    value={report.priority}
                    onValueChange={(p) => handlePriorityChange(report.id, p)}
                    disabled={updatingPriorityId === report.id}
                  >
                    <SelectTrigger className={`w-24 h-6 text-xs ${PRIORITY_COLORS[report.priority] ?? 'bg-surface-variant text-text'}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.filter((o) => o.value).map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <Badge className={STATUS_COLORS[report.status] ?? 'bg-surface-variant text-text'}>
                    {report.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateTime(report.createdAt)}
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/reports/${report.id}`)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-surface">
          <span className="text-sm text-muted-foreground">
            Page {page} of {pages} — {total} total
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}