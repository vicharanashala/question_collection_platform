import { useState, useEffect, useCallback } from 'react'
import { auditApi, getErrorMessage } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import {
  ChevronLeft, ChevronRight, Download, X,
  ScrollText, BarChart3, Activity as ActivityIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/utils'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import type {
  AuditLogEntry,
  AuditLogsResponse,
  AuditStatsResponse,
  AuditSummaryResponse,
  AuditLogQuery,
} from '@/types'

// ─── Action badge color ───────────────────────────────────────────────────────

function actionColor(action: string): string {
  if (action.includes('approved') || action.includes('completed') || action.includes('verified') || action.includes('unsuspended') || action.includes('unbanned')) return 'success'
  if (action.includes('rejected') || action.includes('suspended') || action.includes('banned')) return 'destructive'
  if (action.includes('held')) return 'warning'
  if (action.includes('config') || action.includes('updated')) return 'secondary'
  return 'outline'
}

// ─── Entity Type badge ────────────────────────────────────────────────────────

function entityTypeColor(et: string | null): string {
  switch (et) {
    case 'withdrawal_request': return 'bg-blue-100 text-blue-800'
    case 'user': return 'bg-purple-100 text-purple-800'
    case 'question': return 'bg-green-100 text-green-800'
    case 'admin_config': return 'bg-orange-100 text-orange-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="shadow-xs">
      <CardContent className="p-5">
        <p className="text-sm text-text-tertiary">{label}</p>
        <p className="mt-1 text-3xl font-extrabold text-text tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {sub && <p className="mt-1 text-xs text-text-tertiary">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Value Diff ───────────────────────────────────────────────────────────────

function ValueDiff({ old: oldVal, next: nextVal }: { old: Record<string, unknown> | null; next: Record<string, unknown> | null }) {
  if (!oldVal && !nextVal) return <span className="text-text-tertiary text-xs">—</span>
  const allKeys = new Set([...Object.keys(oldVal ?? {}), ...Object.keys(nextVal ?? {})])
  const changes = Array.from(allKeys).filter((k) => {
    const ov = oldVal?.[k]; const nv = nextVal?.[k]
    return JSON.stringify(ov) !== JSON.stringify(nv)
  })
  if (!changes.length) return <span className="text-text-tertiary text-xs">—</span>
  return (
    <div className="flex flex-col gap-0.5">
      {changes.slice(0, 3).map((k) => (
        <span key={k} className="text-xs">
          <span className="text-destructive font-medium">{String(oldVal?.[k] ?? '∅')}</span>
          {' → '}
          <span className="text-success font-medium">{String(nextVal?.[k] ?? '∅')}</span>
        </span>
      ))}
      {changes.length > 3 && <span className="text-xs text-text-tertiary">+{changes.length - 3} more</span>}
    </div>
  )
}

// ─── Log Detail Slide-over ────────────────────────────────────────────────────

interface LogDetailProps {
  entry: AuditLogEntry | null
  onClose: () => void
}

function LogDetail({ entry, onClose }: LogDetailProps) {
  if (!entry) return null
  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Audit Entry Detail
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-text-tertiary text-xs">Timestamp</p>
              <p className="font-medium">{formatDateTime(entry.createdAt) ?? entry.createdAt}</p>
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Actor</p>
              <p className="font-medium">
                {entry.actorName ?? entry.actorId ?? 'System'}
                {entry.actorRole && <span className="ml-1 text-xs text-text-tertiary">({entry.actorRole})</span>}
              </p>
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Actor Type</p>
              <p className="font-medium capitalize">{entry.actorType}</p>
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Action</p>
              <Badge variant={actionColor(entry.action) as 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'}>{entry.action}</Badge>
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Entity Type</p>
              <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${entityTypeColor(entry.entityType)}`}>
                {entry.entityType ?? '—'}
              </span>
            </div>
            <div>
              <p className="text-text-tertiary text-xs">Entity ID</p>
              <p className="font-mono text-xs break-all">{entry.entityId ?? '—'}</p>
            </div>
          </div>

          {(entry.oldValue || entry.newValue) && (
            <div>
              <p className="text-text-tertiary text-xs mb-1">Changes</p>
              <div className="rounded border border-border-subtle bg-surface-variant p-3 text-xs font-mono space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-text-tertiary text-xs mb-1">Old Value</p>
                    <pre className="text-destructive whitespace-pre-wrap">{entry.oldValue ? JSON.stringify(entry.oldValue, null, 2) : '∅'}</pre>
                  </div>
                  <div>
                    <p className="text-text-tertiary text-xs mb-1">New Value</p>
                    <pre className="text-success whitespace-pre-wrap">{entry.newValue ? JSON.stringify(entry.newValue, null, 2) : '∅'}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {entry.metadata && (
            <div>
              <p className="text-text-tertiary text-xs mb-1">Metadata</p>
              <pre className="rounded border border-border-subtle bg-surface-variant p-3 text-xs font-mono text-text-secondary overflow-auto max-h-40">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

interface OverviewTabProps {
  stats: AuditStatsResponse | null
  summary: AuditSummaryResponse | null
  loading: boolean
  dateFilter: { fromDate: string; toDate: string }
  onDateFilterChange: (f: { fromDate: string; toDate: string }) => void
  onActorClick: (actorId: string) => void
}

function OverviewTab({ stats, summary, loading, dateFilter, onDateFilterChange, onActorClick }: OverviewTabProps) {
  const chartData = summary?.series.map((s) => ({
    date: s.date,
    Withdrawals: s.withdrawals,
    'User Actions': s.userActions,
    'Question Reviews': s.questionReviews,
    'Config Changes': s.configChanges,
  })) ?? []

  return (
    <div className="space-y-6">
      {/* Date filter */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <Label className="text-xs">From</Label>
          <Input type="date" value={dateFilter.fromDate} onChange={(e) => onDateFilterChange({ ...dateFilter, fromDate: e.target.value })} className="mt-1 w-40" />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input type="date" value={dateFilter.toDate} onChange={(e) => onDateFilterChange({ ...dateFilter, toDate: e.target.value })} className="mt-1 w-40" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Actions"
          value={stats?.summary.totalActions ?? '—'}
          sub={stats?.fromDate && stats?.toDate ? `${stats.fromDate} — ${stats.toDate}` : undefined}
        />
        <StatCard
          label="Unique Actors"
          value={stats?.summary.uniqueActors ?? '—'}
          sub="Admins & curators"
        />
        <StatCard
          label="Top Performer"
          value={stats?.summary.mostActiveActorName ?? '—'}
          sub={stats?.summary.mostActiveActor ? `ID: ${stats.summary.mostActiveActor.slice(0, 8)}...` : undefined}
        />
      </div>

      {/* Time-series chart */}
      {chartData.length > 0 && (
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Activity Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Withdrawals" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="User Actions" fill="#a855f7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Question Reviews" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Config Changes" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ActivityIcon className="h-4 w-4" />
            Moderator Activity Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-surface-variant animate-pulse" />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left">
                  <th className="pb-2 font-semibold text-text-secondary text-xs">#</th>
                  <th className="pb-2 font-semibold text-text-secondary text-xs">Actor</th>
                  <th className="pb-2 font-semibold text-text-secondary text-xs">Role</th>
                  <th className="pb-2 font-semibold text-text-secondary text-xs text-center">Withdrawal Approved</th>
                  <th className="pb-2 font-semibold text-text-secondary text-xs text-center">Withdrawal Rejected</th>
                  <th className="pb-2 font-semibold text-text-secondary text-xs text-center">Questions Approved</th>
                  <th className="pb-2 font-semibold text-text-secondary text-xs text-center">Questions Rejected</th>
                  <th className="pb-2 font-semibold text-text-secondary text-xs text-center">Users Suspended</th>
                  <th className="pb-2 font-semibold text-text-secondary text-xs text-center">Config Changed</th>
                  <th className="pb-2 font-semibold text-text-secondary text-xs text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {stats?.actors.map((actor, i) => (
                  <tr
                    key={actor.actorId}
                    className="border-b border-border-subtle hover:bg-surface-variant cursor-pointer transition-colors"
                    onClick={() => onActorClick(actor.actorId)}
                  >
                    <td className="py-2.5 text-text-tertiary">{i + 1}</td>
                    <td className="py-2.5 font-medium">{actor.actorName}</td>
                    <td className="py-2.5">
                      <Badge variant="secondary" className="text-xs">{actor.actorRole}</Badge>
                    </td>
                    <td className="py-2.5 text-center">{actor.withdrawalApproved}</td>
                    <td className="py-2.5 text-center">{actor.withdrawalRejected}</td>
                    <td className="py-2.5 text-center text-success font-medium">{actor.questionApproved}</td>
                    <td className="py-2.5 text-center text-destructive font-medium">{actor.questionRejected}</td>
                    <td className="py-2.5 text-center">{actor.userSuspended + actor.userBanned}</td>
                    <td className="py-2.5 text-center">{actor.configUpdated}</td>
                    <td className="py-2.5 text-center font-bold">{actor.totalActions}</td>
                  </tr>
                ))}
                {(!stats?.actors || stats.actors.length === 0) && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-text-tertiary">No activity found</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

interface ActivityTabProps {
  logs: AuditLogEntry[]
  total: number
  page: number
  pages: number
  loading: boolean
  filters: AuditLogQuery
  onFiltersChange: (f: AuditLogQuery) => void
  onPageChange: (p: number) => void
  onExport: () => void
  onRowClick: (entry: AuditLogEntry) => void
}

const ACTION_OPTIONS = [
  { group: 'Withdrawals', actions: ['withdrawal_approved', 'withdrawal_rejected', 'withdrawal_retry', 'withdrawal_completed'] },
  { group: 'Users', actions: ['user_suspended', 'user_banned', 'user_unsuspended', 'user_unbanned', 'user_verified'] },
  { group: 'Questions', actions: ['question_approved', 'question_rejected', 'question_held'] },
  { group: 'Config', actions: ['admin_config_updated'] },
  { group: 'Auth', actions: ['otp_requested', 'otp_verified', 'otp_expired'] },
]

function ActivityTab({
  logs, total, page, pages, loading,
  filters, onFiltersChange, onPageChange, onExport, onRowClick,
}: ActivityTabProps) {
  const selectedActions = new Set(filters.actions ?? [])

  function toggleAction(action: string) {
    const next = new Set(selectedActions)
    if (next.has(action)) next.delete(action); else next.add(action)
    onFiltersChange({ ...filters, actions: next.size ? Array.from(next) : undefined, page: 1 })
  }

  function clearFilters() {
    onFiltersChange({ page: 1, limit: 50 })
  }

  const hasFilters = !!(filters.actorType || filters.actions?.length || filters.entityType || filters.search || filters.fromDate || filters.toDate)

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <Card className="shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-48">
              <Input
                placeholder="Search actions, entity types..."
                value={filters.search ?? ''}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value || undefined, page: 1 })}
              />
            </div>
            <select
              className="rounded border border-border-subtle bg-surface px-3 py-2 text-sm"
              value={filters.actorType ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, actorType: e.target.value || undefined, page: 1 })}
            >
              <option value="">All Actor Types</option>
              <option value="admin">Admin</option>
              <option value="curator">Curator</option>
              <option value="user">User</option>
              <option value="system">System</option>
            </select>
            <select
              className="rounded border border-border-subtle bg-surface px-3 py-2 text-sm"
              value={filters.entityType ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, entityType: e.target.value || undefined, page: 1 })}
            >
              <option value="">All Entity Types</option>
              <option value="withdrawal_request">Withdrawal</option>
              <option value="user">User</option>
              <option value="question">Question</option>
              <option value="admin_config">Config</option>
            </select>
            <Input
              type="date"
              className="w-36"
              value={filters.fromDate ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, fromDate: e.target.value || undefined, page: 1 })}
            />
            <Input
              type="date"
              className="w-36"
              value={filters.toDate ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, toDate: e.target.value || undefined, page: 1 })}
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-destructive">
                <X className="h-3 w-3" /> Clear
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onExport} className="gap-1 ml-auto">
              <Download className="h-3 w-3" /> Export CSV
            </Button>
          </div>

          {/* Action type checkboxes */}
          <div className="flex flex-wrap gap-3">
            {ACTION_OPTIONS.map(({ group, actions }) => (
              <div key={group} className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-text-tertiary">{group}</p>
                <div className="flex flex-wrap gap-1">
                  {actions.map((action) => {
                    const active = selectedActions.has(action)
                    return (
                      <button
                        key={action}
                        onClick={() => toggleAction(action)}
                        className={`rounded px-2 py-0.5 text-xs border transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-surface text-text-secondary border-border-subtle hover:bg-surface-variant'
                        }`}
                      >
                        {action}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card className="shadow-xs">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left bg-surface-variant">
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs">Timestamp</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs">Actor</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs">Action</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs">Entity Type</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs">Entity ID</th>
                  <th className="px-4 py-3 font-semibold text-text-secondary text-xs">Changes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border-subtle">
                      <td className="px-4 py-3"><div className="h-4 w-28 rounded bg-surface-variant animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-surface-variant animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-surface-variant animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-surface-variant animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-surface-variant animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-40 rounded bg-surface-variant animate-pulse" /></td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-text-tertiary">No audit logs found</td>
                  </tr>
                ) : (
                  logs.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-border-subtle hover:bg-surface-variant cursor-pointer transition-colors"
                      onClick={() => onRowClick(entry)}
                    >
                      <td className="px-4 py-3 text-text-secondary text-xs whitespace-nowrap">
                        {formatDateTime(entry.createdAt) ?? entry.createdAt}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs">{entry.actorName ?? entry.actorId ?? 'System'}</span>
                          {entry.actorRole && (
                            <span className="text-xs text-text-tertiary">{entry.actorRole}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={actionColor(entry.action) as 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'}
                          className="text-xs whitespace-nowrap"
                        >
                          {entry.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${entityTypeColor(entry.entityType)}`}>
                          {entry.entityType ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-text-secondary">{entry.entityId ? `${entry.entityId.slice(0, 8)}...` : '—'}</span>
                      </td>
                      <td className="px-4 py-3 max-w-48">
                        <ValueDiff old={entry.oldValue} next={entry.newValue} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
              <p className="text-sm text-text-secondary">
                Page {page} of {pages} — {total.toLocaleString()} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                  const p = i + 1
                  return (
                    <Button
                      key={p}
                      variant={p === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => onPageChange(p)}
                    >
                      {p}
                    </Button>
                  )
                })}
                {pages > 7 && page < pages && (
                  <>
                    <span className="text-text-tertiary">...</span>
                    <Button variant="outline" size="sm" onClick={() => onPageChange(pages)}>{pages}</Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => onPageChange(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AuditLogsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview')

  // Overview state
  const [stats, setStats] = useState<AuditStatsResponse | null>(null)
  const [summary, setSummary] = useState<AuditSummaryResponse | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [dateFilter, setDateFilter] = useState({ fromDate: '', toDate: '' })

  // Activity state
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [activityLoading, setActivityLoading] = useState(false)
  const [filters, setFilters] = useState<AuditLogQuery>({ page: 1, limit: 50 })

  // Detail modal
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true)
    try {
      const [s, sum] = await Promise.all([
        auditApi.getAuditStats({
          fromDate: dateFilter.fromDate || undefined,
          toDate: dateFilter.toDate || undefined,
        }),
        auditApi.getAuditSummary({
          fromDate: dateFilter.fromDate || undefined,
          toDate: dateFilter.toDate || undefined,
          granularity: 'day',
        }),
      ])
      setStats(s)
      setSummary(sum)
    } catch (e) {
      toast.error('Failed to load audit stats: ' + getErrorMessage(e, 'Unknown error'))
    } finally {
      setOverviewLoading(false)
    }
  }, [dateFilter])

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const res: AuditLogsResponse = await auditApi.getAuditLogs(filters)
      setLogs(res.items)
      setTotal(res.total)
      setCurrentPage(res.page)
      setPages(res.pages)
    } catch (e) {
      toast.error('Failed to load audit logs: ' + getErrorMessage(e, 'Unknown error'))
    } finally {
      setActivityLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchOverview() }, [fetchOverview])
  useEffect(() => { fetchActivity() }, [fetchActivity])

  function handleActorClick(actorId: string) {
    setFilters((f) => ({ ...f, actorId, page: 1 }))
    setActiveTab('activity')
  }

  function handleExport() {
    toast.promise(auditApi.exportCSV(filters as unknown as Record<string, string | number | undefined | string[]>), {
      loading: 'Exporting...',
      success: 'Audit logs exported successfully',
      error: 'Export failed',
    })
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <ScrollText className="h-6 w-6" />
            Audit Logs
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Complete record of all admin and curator actions
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'overview' | 'activity')}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5">
            <ActivityIcon className="h-3.5 w-3.5" /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            stats={stats}
            summary={summary}
            loading={overviewLoading}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            onActorClick={handleActorClick}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab
            logs={logs}
            total={total}
            page={currentPage}
            pages={pages}
            loading={activityLoading}
            filters={filters}
            onFiltersChange={(f) => { setFilters(f); setCurrentPage(f.page ?? 1) }}
            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
            onExport={handleExport}
            onRowClick={setSelectedEntry}
          />
        </TabsContent>
      </Tabs>

      {/* Detail slide-over */}
      <LogDetail entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </div>
  )
}