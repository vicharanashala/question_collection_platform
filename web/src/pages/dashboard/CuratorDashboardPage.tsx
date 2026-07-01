/**
 * Curator Dashboard — Question Review Focused
 * Role: curator
 *
 * Fetches only curator-appropriate data:
 *   - Question metrics (getQuestionMetrics) — no user verification data
 *   - Review queue counts (adminApi.listReviewQueue)
 *
 * Excludes: user stats, finance data, wallet data, audit logs.
 */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, curatorApi, getErrorMessage } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartCard } from '@/components/charts/ChartCard'
import { AreaChartComponent } from '@/components/charts/AreaChartComponent'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { DashboardSkeleton } from '@/components/ui/skeleton'
import { cn, formatNumber } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import {
  MessageSquare, CheckCircle, Ban, Clock, TrendingUp, TrendingDown,
  Minus, ArrowRight, CheckSquare, AlertTriangle, BarChart3, Sparkles,
  Activity, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types'

// ─── StatCard (reused from DashboardPage) ─────────────────────────────────────

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

// ─── Types for curator metrics ─────────────────────────────────────────────────

interface CuratorMetrics {
  period: { from: string; to: string }
  summary: {
    total: number
    approved: number
    rejected: number
    pending: number
    aiReview: number
    humanReview: number
    duplicates: number
    approvalRate: number
    avgTurnaroundMinutes: number
  }
  dailyVolume: Array<{ date: string; total: number; approved: number; rejected: number }>
  cropBreakdown: Array<{ cropType: string; count: number }>
  stateBreakdown: Array<{ state: string; count: number }>
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TIME_RANGES: { value: string; label: string; days: number }[] = [
  { value: '7d', label: '7D', days: 7 },
  { value: '30d', label: '30D', days: 30 },
  { value: '90d', label: '90D', days: 90 },
]

export function CuratorDashboardPage() {
  const [timeRange, setTimeRange] = useState('30d')
  const [metrics, setMetrics] = useState<CuratorMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [queueCount, setQueueCount] = useState(0)
  const [queueLoading, setQueueLoading] = useState(true)

  const days = TIME_RANGES.find((r) => r.value === timeRange)?.days ?? 30
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const toDate = new Date().toISOString()

  // Load question metrics
  useEffect(() => {
    adminApi.getQuestionMetrics({ fromDate, toDate })
      .then(setMetrics)
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load question metrics')))
      .finally(() => setMetricsLoading(false))
  }, [fromDate, toDate])

  // Load review queue count (only pending + ai_review + human_review for curator's view)
  useEffect(() => {
    curatorApi.getReviewQueue({ status: ['pending', 'ai_review', 'human_review'], limit: 1 })
      .then((res) => setQueueCount(res.total))
      .catch(() => setQueueCount(0))
      .finally(() => setQueueLoading(false))
  }, [])

  const s = metrics?.summary

  // Derived chart data
  const qStatusData = [
    { name: 'Pending', value: s?.pending ?? 0 },
    { name: 'AI Review', value: s?.aiReview ?? 0 },
    { name: 'Human Review', value: s?.humanReview ?? 0 },
    { name: 'Approved', value: s?.approved ?? 0 },
    { name: 'Rejected', value: s?.rejected ?? 0 },
  ]

  const stateBarData = (metrics?.stateBreakdown ?? []).slice(0, 8).map((st) => ({
    name: st.state,
    value: st.count,
  }))

  const cropDonutData = (metrics?.cropBreakdown ?? []).slice(0, 7).map((c) => ({
    name: c.cropType,
    value: c.count,
  }))

  if (metricsLoading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-text">Review Dashboard</h2>
          <p className="text-sm text-text-tertiary">
            Question review metrics · {TIME_RANGES.find((r) => r.value === timeRange)?.label} period
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
          value={queueLoading ? '—' : formatNumber(queueCount)}
          sub="awaiting review"
          variant="warning"
        />
        <StatCard
          icon={CheckCircle}
          label="Approved"
          value={formatNumber(s?.approved ?? 0)}
          sub={`${s?.approvalRate ?? 0}% approval rate`}
          variant="success"
        />
        <StatCard
          icon={Ban}
          label="Rejected"
          value={formatNumber(s?.rejected ?? 0)}
          sub={`${s?.duplicates ?? 0} duplicates`}
          variant="danger"
        />
        <StatCard
          icon={Clock}
          label="Avg Review Time"
          value={s?.avgTurnaroundMinutes != null ? `${s.avgTurnaroundMinutes}m` : '—'}
          sub="submission to decision"
          variant="info"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={MessageSquare} label="Total Submitted" value={formatNumber(s?.total ?? 0)} variant="primary" />
        <StatCard icon={AlertTriangle} label="Pending" value={formatNumber(s?.pending ?? 0)} variant="warning" />
        <StatCard icon={Sparkles} label="AI Review" value={formatNumber(s?.aiReview ?? 0)} variant="info" />
        <StatCard icon={Activity} label="Human Review" value={formatNumber(s?.humanReview ?? 0)} variant="info" />
        <StatCard icon={TrendingUp} label="Growth Rate" value={`${s?.approvalRate ?? 0}%`} variant="success" />
      </div>

      {/* SLA Warning — only shows if avg turnaround > 60 minutes */}
      {s?.avgTurnaroundMinutes != null && s.avgTurnaroundMinutes > 60 && (
        <Card className="shadow-xs border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-destructive">SLA Breach Warning</p>
              <p className="text-xs text-text-secondary mt-0.5">
                Average review turnaround is <span className="font-semibold">{s.avgTurnaroundMinutes}m</span> — above the 60-minute target.
                {queueCount > 0 && (
                  <span> <span className="font-semibold">{formatNumber(queueCount)}</span> questions pending review.</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts row 1: Daily volume + Status breakdown */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Daily Submission Volume"
          subtitle={`Last ${days} days — submitted, approved, rejected`}
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
          {metrics?.dailyVolume && metrics.dailyVolume.length > 0 ? (
            <>
              <AreaChartComponent
                data={metrics.dailyVolume.map((v) => ({ date: v.date, Submitted: v.total, Approved: v.approved, Rejected: v.rejected }))}
                dataKey="Submitted"
                color="hsl(var(--primary))"
                gradientId="curatorVolume"
                height={200}
                valueFormatter={(v) => formatNumber(v)}
              />
              <div className="flex gap-6 mt-2 px-1 pb-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                  Approved: {formatNumber(s?.approved ?? 0)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive inline-block" />
                  Rejected: {formatNumber(s?.rejected ?? 0)}
                </span>
              </div>
            </>
          ) : (
            <div className="h-56 flex items-center justify-center text-sm text-text-tertiary">
              No volume data available
            </div>
          )}
        </ChartCard>

        <ChartCard title="Questions by Status" subtitle="Current distribution">
          <BarChartComponent
            data={qStatusData}
            dataKey="value"
            color="hsl(var(--primary))"
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
            data={cropDonutData}
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
            {queueCount > 0 ? (
              <Badge variant="destructive">{formatNumber(queueCount)}</Badge>
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