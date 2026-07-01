/**
 * Curator Dashboard — Question Review Focused
 * Role: curator
 *
 * Uses curatorApi.getCuratorStats() — a single efficient endpoint returning:
 *   - Queue breakdown by status
 *   - Submission volume (today / this week / this month)
 *   - Approval rate with prior-period comparison
 *   - Average review turnaround
 *   - Daily volume trend (last 30 days)
 *   - Crop / state / domain breakdowns
 *
 * Excludes: user stats, finance data, wallet data, audit logs.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { curatorApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartCard } from '@/components/charts/ChartCard'
import { AreaChartComponent } from '@/components/charts/AreaChartComponent'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { DashboardSkeleton } from '@/components/ui/skeleton'
import { cn, formatNumber } from '@/lib/utils'
import {
  CheckSquare, CheckCircle, Ban, TrendingUp, TrendingDown,
  Minus, ArrowRight, AlertTriangle, MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import type { CuratorStats } from '@/types'

// ─── StatCard ─────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | string
  change?: number
  sub?: string
  icon: React.ElementType
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

function StatCard({ label, value, change, sub, icon: Icon, variant }: StatCardProps) {
  const isPositive = (change ?? 0) >= 0
  const isNeutral = change === undefined || change === 0
  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown
  const trendColor = isNeutral ? 'text-text-tertiary' : isPositive ? 'text-success' : 'text-destructive'
  const iconVariant = variant ?? 'primary'

  return (
    <Card className="shadow-xs">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-tertiary truncate">{label}</p>
            <p className="mt-1 text-3xl font-extrabold text-text tabular-nums">
              {typeof value === 'number' ? formatNumber(value) : value}
            </p>
            {(change !== undefined || sub) && (
              <div className="mt-2 flex items-center gap-2">
                {!isNeutral && (
                  <span className={cn('flex items-center gap-0.5 text-xs font-semibold', trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    {isPositive ? '+' : ''}{change}%
                  </span>
                )}
                {sub && <span className="text-xs text-text-tertiary truncate">{sub}</span>}
              </div>
            )}
          </div>
          <div className={cn('rounded-xl p-3 ml-3 shrink-0 stat-icon', `stat-icon-${iconVariant}`)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────

const TIME_RANGES: { value: string; label: string; days: number }[] = [
  { value: '30d', label: '30D', days: 30 },
  { value: '7d', label: '7D', days: 7 },
  { value: '90d', label: '90D', days: 90 },
]

export function CuratorDashboardPage() {
  const [timeRange, setTimeRange] = useState('30d')
  const [stats, setStats] = useState<CuratorStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Load curator stats (backend computes all period breakdowns internally)
  useEffect(() => {
    curatorApi.getCuratorStats()
      .then(setStats)
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load curator stats')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <DashboardSkeleton />
  if (!stats) return null

  const { queue, performance } = stats

  // Derive queue pending total (non-terminal statuses)
  const pendingTotal = queue.breakdown.reduce((sum, b) => {
    if (b.status !== 'approved' && b.status !== 'rejected') return sum + b.count
    return sum
  }, 0)

  // SLA breach: avg turnaround > 60 min
  const slaBreach = performance.avgReviewTurnaroundMinutes != null && performance.avgReviewTurnaroundMinutes > 60

  // Chart data — daily volume uses Submitted (all submitted) + Approved + Rejected
  const dailyVolume = (stats.dailyVolume ?? []).map((d) => ({
    date: d.date,
    Submitted: d.submitted,
    Approved: d.approved,
    Rejected: d.rejected,
  }))

  const stateBarData = (stats.stateBreakdown ?? []).slice(0, 8).map((s) => ({
    name: s.state,
    value: s.count,
  }))

  const cropBarData = (stats.cropBreakdown ?? []).slice(0, 7).map((c) => ({
    name: c.cropType,
    value: c.count,
  }))

  const queueBarData = queue.breakdown.map((b) => ({
    name: b.label,
    value: b.count,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-text">Review Dashboard</h2>
          <p className="text-sm text-text-tertiary">
            Curator overview · last 30 days
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-border-subtle bg-surface p-1 shadow-xs">
          {TIME_RANGES.map((r) => (
            <Button
              key={r.value}
              variant={timeRange === r.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimeRange(r.value)}
              className={cn('h-7 text-xs', timeRange !== r.value && 'text-text-tertiary')}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Primary stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CheckSquare}
          label="Review Queue"
          value={formatNumber(queue.total)}
          sub={`${formatNumber(pendingTotal)} awaiting action`}
          variant="warning"
        />
        <StatCard
          icon={CheckCircle}
          label="Approved"
          value={formatNumber(performance.approved30Days)}
          sub={`${performance.approvalRate}% approval rate`}
          change={performance.approvalRateChange}
          variant="success"
        />
        <StatCard
          icon={Ban}
          label="Rejected"
          value={formatNumber(performance.rejected30Days)}
          sub={`${stats.volume.last30Days} total submitted`}
          variant="danger"
        />
      </div>

      {/* SLA breach alert */}
      {slaBreach && (
        <Card className="shadow-xs border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-destructive">SLA Breach Warning</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Average review turnaround is{' '}
                <span className="font-semibold">{performance.avgReviewTurnaroundMinutes}m</span> —
                above the 60-minute target.
                {queue.total > 0 && (
                  <span> <span className="font-semibold">{formatNumber(queue.total)}</span> questions in queue.</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts row 1: Daily volume + Queue breakdown */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Daily Submission Volume"
          subtitle={`Last 30 days — submitted, approved, rejected`}
          action={
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Submitted
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> Approved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive" /> Rejected
              </span>
            </div>
          }
        >
          {dailyVolume.length > 0 ? (
            <AreaChartComponent
              data={dailyVolume}
              dataKey="Submitted"
              color="hsl(var(--primary))"
              gradientId="curatorVolume"
              height={200}
              valueFormatter={(v) => formatNumber(v)}
            />
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-text-tertiary">
              No volume data available
            </div>
          )}
        </ChartCard>

        <ChartCard title="Queue by Status" subtitle="Current distribution">
          <BarChartComponent
            data={queueBarData}
            dataKey="value"
            color="hsl(var(--warning))"
            height={260}
            valueFormatter={(v) => formatNumber(v)}
          />
        </ChartCard>
      </div>

      {/* Charts row 2: State + Crop breakdown */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Top States by Volume" subtitle="Questions submitted per state">
          <BarChartComponent
            data={stateBarData}
            dataKey="value"
            color="hsl(var(--chart-2))"
            height={220}
            valueFormatter={(v) => formatNumber(v)}
          />
        </ChartCard>

        <ChartCard title="Top Crops" subtitle="Question distribution by crop type">
          <BarChartComponent
            data={cropBarData}
            dataKey="value"
            color="hsl(var(--chart-3))"
            height={220}
            valueFormatter={(v) => formatNumber(v)}
          />
        </ChartCard>
      </div>

      {/* Quick actions */}
      <ChartCard title="Quick Actions" subtitle="Navigate the platform">
        <div className="grid gap-3 md:grid-cols-2 pt-1">
          <Link
            to="/reviews"
            className="flex items-center justify-between rounded-md border border-border-subtle p-3 text-sm font-medium hover:bg-surface-variant transition-colors group"
          >
            <span className="flex items-center gap-3">
              <CheckSquare className="h-4 w-4 text-primary" />
              Review Queue
            </span>
            {queue.total > 0 ? (
              <Badge variant="destructive">{formatNumber(queue.total)}</Badge>
            ) : (
              <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-text transition-colors" />
            )}
          </Link>
          <Link
            to="/questions"
            className="flex items-center justify-between rounded-md border border-border-subtle p-3 text-sm font-medium hover:bg-surface-variant transition-colors group"
          >
            <span className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-primary" />
              All Questions
            </span>
            <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-text transition-colors" />
          </Link>
        </div>
      </ChartCard>
    </div>
  )
}