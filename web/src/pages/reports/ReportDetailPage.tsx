import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportsApi, getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import { ArrowLeft, Send, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { Report } from '@/types'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const PRIORITY_OPTIONS = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug',
  payout_issue: 'Payout Issue',
  question_issue: 'Question Issue',
  abuse: 'Abuse',
  feature_request: 'Feature Request',
  other: 'Other',
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

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const navigate = useNavigate()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingPriority, setUpdatingPriority] = useState(false)

  const fetchReport = useCallback(async () => {
    if (!reportId) return
    setLoading(true)
    try {
      const data = await reportsApi.get(reportId)
      setReport(data as Report)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load report'))
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => { fetchReport() }, [fetchReport])

  const handleSendReply = async () => {
    if (!replyText.trim() || !reportId) return
    setSending(true)
    try {
      await reportsApi.addReply(reportId, replyText.trim())
      setReplyText('')
      toast.success('Reply sent')
      await fetchReport()
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to send reply'))
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    if (!reportId) return
    setUpdatingStatus(true)
    try {
      await reportsApi.updateStatus(reportId, status)
      toast.success('Status updated')
      await fetchReport()
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to update status'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handlePriorityChange = async (priority: string) => {
    if (!reportId) return
    setUpdatingPriority(true)
    try {
      await reportsApi.updatePriority(reportId, priority)
      toast.success('Priority updated')
      await fetchReport()
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to update priority'))
    } finally {
      setUpdatingPriority(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <ArrowLeft className="h-5 w-5 cursor-pointer" onClick={() => navigate('/reports')} />
          <div className="h-5 w-40 rounded bg-surface-variant animate-pulse" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-surface-variant animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-muted-foreground">Report not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/reports')}>
          Back to Reports
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <ArrowLeft
            className="h-5 w-5 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => navigate('/reports')}
          />
          <h1 className="text-lg font-semibold">Report Detail</h1>
        </div>

        {/* Status + Priority controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Select
              value={report.status}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Priority:</span>
            <Select
              value={report.priority}
              onValueChange={handlePriorityChange}
              disabled={updatingPriority}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Metadata card */}
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Reporter</p>
              <p className="font-medium">{report.user?.name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{report.user?.mobileNumber ?? ''}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Category</p>
              <Badge className="mt-1 bg-surface-variant text-text">
                {CATEGORY_LABELS[report.category] ?? report.category}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Priority</p>
              <Badge className={`mt-1 ${PRIORITY_COLORS[report.priority] ?? 'bg-surface-variant text-text'}`}>
                {report.priority}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{formatDateTime(report.createdAt)}</p>
            </div>
          </div>

          {report.relatedEntityId && (
            <div className="pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Related: {report.relatedEntityType} — #{report.relatedEntityId}
              </p>
            </div>
          )}

          {/* Title + description */}
          <div className="pt-2 border-t border-border">
            <h2 className="font-semibold text-base mb-2">{report.title}</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{report.description}</p>
          </div>
        </Card>

        {/* Reply thread */}
        {report.replies && report.replies.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Replies ({report.replies.length})
            </h3>
            {report.replies.map((reply) => (
              <Card key={reply.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {(reply.admin?.name ?? 'A').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {reply.admin?.name ?? 'Admin'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(reply.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Reply form */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Add Reply
          </h3>
          <Textarea
            placeholder="Type your reply to the user..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={4}
            maxLength={5000}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {replyText.length}/5000
            </span>
            <Button
              onClick={handleSendReply}
              disabled={!replyText.trim() || sending}
            >
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'Sending...' : 'Send Reply'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}