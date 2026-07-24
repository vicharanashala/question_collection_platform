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
import { ArrowLeft, Send, Sparkles, CheckCircle2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
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

const REPLY_SUGGESTIONS: Record<string, string[]> = {
  bug: [
    'Thank you for reporting this bug. We are looking into it and will fix it shortly.',
    'We have identified the bug and our team is working on a fix. Expected resolution: 2-3 business days.',
    'This bug has been reported to our development team. We will notify you once it is resolved.',
    'We apologize for the inconvenience. The bug has been logged and prioritised for the next release.',
  ],
  payout_issue: [
    'We are reviewing your payout issue and will get back to you within 24-48 hours.',
    'Your payout has been flagged for review. Our finance team will process it manually and update you shortly.',
    'We noticed a delay in your payout. Please share your transaction ID so we can trace it faster.',
    'Your payout is being processed. Expected credit within 2-3 business days.',
  ],
  question_issue: [
    'Thank you for reaching out. We have reviewed your query and here is the resolution.',
    'Your question has been answered. If you need further assistance, please let us know.',
    'We have clarified the issue on our end. The relevant section has been updated for better understanding.',
    'Your concern has been noted and the team has been informed. Expected response within 48 hours.',
  ],
  abuse: [
    'We have reviewed your report and found a violation of our community guidelines. Appropriate action has been taken.',
    'Thank you for reporting this. We take abuse reports seriously and are investigating further.',
    'This content has been reviewed and removed for violating our terms. The user has been warned.',
    'We have escalated this report to our moderation team. We will keep you updated on the action taken.',
  ],
  feature_request: [
    'Thank you for your suggestion! We have noted it and will consider it for a future update.',
    'Your feature request has been logged. We appreciate your feedback and will evaluate it for upcoming releases.',
    'Great suggestion! We have forwarded this to our product team for consideration.',
    'We value your input. While we cannot commit to a timeline, this is being tracked for future planning.',
  ],
  other: [
    'Thank you for contacting us. We are looking into your concern and will respond shortly.',
    'We have received your report and our team is reviewing it. Expected response within 48 hours.',
    'We appreciate you bringing this to our attention. Please let us know if you need further assistance.',
    'Your message has been noted. We will get back to you with a resolution shortly.',
  ],
}

const GENERAL_SUGGESTIONS = [
  'Thank you for contacting us. We have noted your concern and will respond shortly.',
  'We are looking into your report. You can expect an update within 48 hours.',
  'We appreciate your patience. Please reach out again if you do not hear back within 5 business days.',
  'Your request has been escalated to the relevant team. We will keep you updated.',
]

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
  const [markingClosed, setMarkingClosed] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)

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

  const handleMarkClosed = () => {
    if (report.status === 'closed') return
    setShowCloseModal(true)
  }

  const confirmMarkClosed = async () => {
    if (!reportId) return
    setShowCloseModal(false)
    setMarkingClosed(true)
    try {
      await reportsApi.updateStatus(reportId, 'closed')
      toast.success('Report marked as closed')
      await fetchReport()
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to close report'))
    } finally {
      setMarkingClosed(false)
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
          {report.status !== 'closed' && (
            <Button
              variant="success"
              onClick={handleMarkClosed}
              disabled={markingClosed}
              className="gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {markingClosed ? 'Closing...' : 'Mark as Closed'}
            </Button>
          )}

          {/* Close confirmation modal */}
          <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Close this report?</DialogTitle>
                <DialogDescription>
                  Marking this report as closed will notify the user that their issue has been resolved. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCloseModal(false)}
                  disabled={markingClosed}
                >
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onClick={confirmMarkClosed}
                  disabled={markingClosed}
                  className="gap-1.5"
                >
                  {markingClosed ? 'Closing...' : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Yes, Close Report
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

          {/* Suggestions */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Suggestions</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(REPLY_SUGGESTIONS[report.category] ?? GENERAL_SUGGESTIONS).map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setReplyText(suggestion)
                    // scroll textarea into view smoothly
                    document.getElementById('reply-textarea')?.focus()
                  }}
                  className="text-left text-xs px-3 py-1.5 rounded-full border border-border bg-surface hover:bg-surface-variant hover:border-primary/40 transition-colors text-foreground shadow-sm"
                >
                  {suggestion.length > 60 ? suggestion.slice(0, 57) + '...' : suggestion}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            id="reply-textarea"
            placeholder="Type your reply to the user, or select a suggestion above..."
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