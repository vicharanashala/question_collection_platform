import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import {
  Bell, BellOff, CheckCheck, MessageSquare,
  CheckCircle, XCircle, PauseCircle, Coins,
  CreditCard, AlertTriangle, ShieldOff, Ban,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Notification } from '@/types'

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  question_approved:       { icon: CheckCircle,  color: 'text-success',     label: 'Approved' },
  question_rejected:       { icon: XCircle,      color: 'text-destructive', label: 'Rejected' },
  question_held:           { icon: PauseCircle,  color: 'text-warning',     label: 'Held' },
  question_info_requested: { icon: MessageSquare, color: 'text-blue-500',   label: 'Info Requested' },
  duplicate_question:      { icon: AlertTriangle, color: 'text-warning',    label: 'Duplicate' },
  reward_credited:         { icon: Coins,        color: 'text-success',     label: 'Reward Credited' },
  withdrawal_approved:     { icon: CheckCircle,  color: 'text-success',     label: 'Withdrawal Approved' },
  withdrawal_rejected:     { icon: XCircle,      color: 'text-destructive', label: 'Withdrawal Rejected' },
  account_suspended:       { icon: ShieldOff,    color: 'text-destructive', label: 'Account Suspended' },
  account_banned:          { icon: Ban,          color: 'text-destructive', label: 'Account Banned' },
}

function groupByDate(items: Notification[]): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {}
  for (const item of items) {
    const d = new Date(item.createdAt)
    const key = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Notification[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState<string | null>(null)
  const limit = 20

  function handleNotificationClick(notif: Notification) {
    if (!notif.isRead) {
      handleMarkRead(notif.id)
    }
    const d = notif.data ?? {}
    const userId: string | undefined = d.userId as string | undefined
    const isWithdrawal = notif.type === 'withdrawal_approved' || notif.type === 'withdrawal_rejected'
    if (isWithdrawal && userId) {
      navigate('/wallets', { state: { openUserId: userId } })
    }
  }

  const fetch_ = useCallback((pg: number, refresh = false) => {
    setLoading(!refresh)
    notificationApi.getNotifications({ page: pg, limit })
      .then((res) => {
        setItems((prev) => refresh ? res.items : (prev) => [...prev, ...res.items])
        setTotal(res.total)
        setUnreadCount(res.unreadCount)
      })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load notifications')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch_(1, true) }, [fetch_])

  async function handleMarkRead(id: string) {
    setMarking(id)
    try {
      await notificationApi.markRead(id)
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to mark as read'))
    } finally {
      setMarking(null)
    }
  }

  async function handleMarkAllRead() {
    setMarking('all')
    try {
      await notificationApi.markAllRead()
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to mark all as read'))
    } finally {
      setMarking(null)
    }
  }

  const groups = groupByDate(items)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Notifications</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
              : 'You\'re all caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleMarkAllRead}
            disabled={marking === 'all'}
          >
            <CheckCheck className="h-4 w-4" />
            {marking === 'all' ? 'Marking...' : 'Mark all as read'}
          </Button>
        )}
      </div>

      {/* List */}
      {loading && items.length === 0 ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-20 bg-muted/30 rounded-lg" />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BellOff className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              We&apos;ll notify you when something important happens
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([date, notifs]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                {date}
              </p>
              <Card>
                <div className="divide-y divide-border-subtle">
                  {notifs.map((notif) => {
                    const meta = TYPE_META[notif.type] ?? { icon: Bell, color: 'text-muted-foreground', label: notif.type }
                    const Icon = meta.icon
                    return (
                      <div
                        key={notif.id}
                        className={cn(
                          'flex items-start gap-3 px-4 py-3.5 hover:bg-surface-variant/40 transition-colors cursor-pointer',
                          !notif.isRead && 'bg-primary/5',
                        )}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        {/* Icon */}
                        <div className={cn('mt-0.5 shrink-0', meta.color)}>
                          <Icon className="h-5 w-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn('text-sm font-semibold', !notif.isRead ? 'text-foreground' : 'text-muted-foreground')}>
                              {notif.title}
                            </p>
                            {!notif.isRead && (
                              <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {notif.body}
                          </p>
                          <p className="text-xs text-muted-foreground/60 mt-1">
                            {new Date(notif.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        {/* Mark-read button when read */}
                        {notif.isRead && marking !== notif.id && (
                          <button
                            className="shrink-0 text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5"
                            onClick={(e) => { e.stopPropagation(); handleMarkRead(notif.id) }}
                            title="Mark as unread"
                          >
                            <Bell className="h-4 w-4" />
                          </button>
                        )}
                        {marking === notif.id && (
                          <span className="shrink-0 text-xs text-muted-foreground mt-0.5">...</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          ))}

          {/* Load more */}
          {items.length < total && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { const next = page + 1; setPage(next); fetch_(next) }}
                disabled={loading}
              >
                {loading ? 'Loading...' : `Load more (${total - items.length} remaining)`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}