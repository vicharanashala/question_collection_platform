/**
 * Public Notifications page — mirrors mobile/src/screens/Notification/NotificationScreen.tsx
 *
 * Reached from the bell icon in the public header. Paginated notification
 * list with unread indicator, "Mark all read", and tap-to-navigate to the
 * related question/withdrawal/report.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Bell, CheckCheck, CheckCircle2, XCircle, Clock, Info,
  Banknote, Wallet, MessageCircle, AlertTriangle, ShieldOff, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Notification } from '@/types'

const PAGE_SIZE = 20

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const TYPE_ICON: Record<string, { icon: typeof Bell; className: string; bg: string }> = {
  question_approved:      { icon: CheckCircle2,  className: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  question_rejected:      { icon: XCircle,        className: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-950/40' },
  question_held:          { icon: Clock,          className: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-950/40' },
  question_info_requested:{ icon: Info,           className: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-950/40' },
  reward_credited:        { icon: Banknote,       className: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  withdrawal_approved:    { icon: Wallet,         className: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  withdrawal_rejected:    { icon: Wallet,         className: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-950/40' },
  report_reply:           { icon: MessageCircle,  className: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
  report_closed:          { icon: CheckCircle2,   className: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  account_suspended:      { icon: AlertTriangle,  className: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-950/40' },
  account_banned:         { icon: ShieldOff,      className: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-950/40' },
}

function iconFor(type: string) {
  return TYPE_ICON[type] ?? { icon: Bell, className: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40' }
}

function targetFor(n: Notification): string | null {
  const data = n.data as Record<string, unknown> | null
  if (n.triggerType === 'question') return '/public/questions'
  if (n.triggerType === 'withdraw') return '/public/wallet'
  if (n.triggerType === 'report' && data?.reportId) return `/public/reports/${data.reportId}`
  return null
}

// ─── Notification row ────────────────────────────────────────────────────────

function NotificationRow({ item, onPress }: { item: Notification; onPress: () => void }) {
  const { icon: Icon, className, bg } = iconFor(item.type)
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors',
        item.isRead
          ? 'border-border-subtle bg-surface hover:border-emerald-200 dark:hover:border-emerald-800'
          : 'border-emerald-200/70 bg-emerald-50/40 hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:border-emerald-700',
      )}
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', bg)}>
        <Icon className={cn('h-5 w-5', className)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="flex-1 truncate text-sm font-bold text-foreground">{item.title}</p>
          {!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{item.body}</p>
        <p className="mt-1 text-[11px] text-text-tertiary">{timeAgo(item.createdAt)}</p>
      </div>
    </button>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function PublicNotificationsPage(): ReactNode {
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPage = useCallback(async (p: number, append: boolean) => {
    try {
      const res = await notificationApi.getNotifications({ page: p, limit: PAGE_SIZE })
      setNotifications((prev) => (append ? [...prev, ...res.notifications] : res.notifications))
      setUnread(res.unread)
      setTotal(res.total)
      setPage(p)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load notifications'))
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchPage(1, false)
  }, [fetchPage])

  async function handleMarkAllRead() {
    try {
      await notificationApi.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnread(0)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to mark notifications as read'))
    }
  }

  async function handleOpen(item: Notification) {
    if (!item.isRead) {
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)))
      setUnread((u) => Math.max(0, u - 1))
      notificationApi.markRead(item.id).catch(() => {})
    }
    const target = targetFor(item)
    if (target) navigate(target)
  }

  function handleLoadMore() {
    setLoadingMore(true)
    fetchPage(page + 1, true)
  }

  const hasMore = notifications.length < total

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/50">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Notifications</h1>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="rounded-full">
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-text-tertiary">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm font-medium">Loading notifications…</p>
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-variant dark:bg-surface-variant">
              <Bell className="h-12 w-12 text-text-tertiary" strokeWidth={1.75} />
            </div>
            <h2 className="mt-5 text-xl font-extrabold text-foreground">No notifications yet</h2>
            <p className="mt-2 max-w-sm text-sm text-text-secondary">You&rsquo;re all caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => (
            <NotificationRow key={n.id} item={n} onPress={() => handleOpen(n)} />
          ))}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="pt-2 text-center text-xs text-text-tertiary">AnnaDatha &mdash; Made for Indian farmers</p>
    </div>
  )
}

export default PublicNotificationsPage
