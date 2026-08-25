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
import { useTranslation, Trans } from 'react-i18next'
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
            <p className="text-xs sm:text-sm text-text-tertiary truncate">{label}</p>
            <p className="mt-1 text-2xl sm:text-3xl font-extrabold text-text tabular-nums">
              {typeof value === 'number' ? formatNumber(value) : value}
            </p>
            {(change !== undefined || sub) && (
              <div className="mt-2 flex items-center gap-2">
                {!isNeutral && (
                  <span className={cn('flex items-center gap-0.5 text-[11px] sm:text-[11px] sm:text-xs font-semibold', trendColor)}>
                    <TrendIcon className="h-3 w-3" />
                    {isPositive ? '+' : ''}{change}%
                  </span>
                )}
                {sub && <span className="text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary truncate">{sub}</span>}
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

const TIME_RANGES: { value: string; labelKey: 'range30d' | 'range7d' | 'range90d'; days: number }[] = [
  { value: '30d', labelKey: 'range30d', days: 30 },
  { value: '7d', labelKey: 'range7d', days: 7 },
  { value: '90d', labelKey: 'range90d', days: 90 },
]

export function CuratorDashboardPage() {
  const { t } = useTranslation()
  const [timeRange, setTimeRange] = useState('30d')
  const [stats, setStats] = useState<CuratorStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Load curator stats (backend computes all period breakdowns internally)
  useEffect(() => {
    curatorApi.getCuratorStats()
      .then(setStats)
      .catch((e) => toast.error(getErrorMessage(e, t('curatorDashboard.loadError'))))
      .finally(() => setLoading(false))
  }, [t])

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
    <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-text">{t('curatorDashboard.title')}</h2>
          <p className="text-xs sm:text-xs sm:text-sm text-text-tertiary">
            {t('curatorDashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center rounded-lg border border-border-subtle bg-surface p-1 shadow-xs">
          {TIME_RANGES.map((r) => (
            <Button
              key={r.value}
              variant={timeRange === r.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimeRange(r.value)}
              className={cn('h-7 text-[11px] sm:text-[11px] sm:text-xs', timeRange !== r.value && 'text-text-tertiary')}
            >
              {t(`curatorDashboard.${r.labelKey}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Primary stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={CheckSquare}
          label={t('curatorDashboard.statQueue')}
          value={formatNumber(queue.total)}
          sub={t('curatorDashboard.statQueueSub', { count: formatNumber(pendingTotal) })}
          variant="warning"
        />
        <StatCard
          icon={CheckCircle}
          label={t('curatorDashboard.statApproved')}
          value={formatNumber(performance.approved30Days)}
          sub={t('curatorDashboard.statApprovedSub', { rate: performance.approvalRate })}
          change={performance.approvalRateChange}
          variant="success"
        />
        <StatCard
          icon={Ban}
          label={t('curatorDashboard.statRejected')}
          value={formatNumber(performance.rejected30Days)}
          sub={t('curatorDashboard.statRejectedSub', { count: stats.volume.last30Days })}
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
              <p className="text-xs sm:text-xs sm:text-sm font-semibold text-destructive">{t('curatorDashboard.slaTitle')}</p>
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-secondary mt-0.5">
                <Trans
                  i18nKey="curatorDashboard.slaMessage"
                  values={{ minutes: performance.avgReviewTurnaroundMinutes }}
                  components={{ bold: <span className="font-semibold" /> }}
                />
                {queue.total > 0 && (
                  <> {' '}<Trans
                    i18nKey="curatorDashboard.slaQueueNote"
                    values={{ count: formatNumber(queue.total) }}
                    components={{ bold: <span className="font-semibold" /> }}
                  /></>
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
          title={t('curatorDashboard.dailyVolumeTitle')}
          subtitle={t('curatorDashboard.dailyVolumeSub')}
          action={
            <div className="flex gap-4 text-[11px] sm:text-[11px] sm:text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> {t('curatorDashboard.legendSubmitted')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> {t('curatorDashboard.legendApproved')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive" /> {t('curatorDashboard.legendRejected')}
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
            <div className="h-48 flex items-center justify-center text-xs sm:text-xs sm:text-sm text-text-tertiary">
              {t('curatorDashboard.noVolumeData')}
            </div>
          )}
        </ChartCard>

        <ChartCard title={t('curatorDashboard.queueByStatusTitle')} subtitle={t('curatorDashboard.queueByStatusSub')}>
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
        <ChartCard title={t('curatorDashboard.topStatesTitle')} subtitle={t('curatorDashboard.topStatesSub')}>
          <BarChartComponent
            data={stateBarData}
            dataKey="value"
            color="hsl(var(--chart-2))"
            height={220}
            valueFormatter={(v) => formatNumber(v)}
          />
        </ChartCard>

        <ChartCard title={t('curatorDashboard.topCropsTitle')} subtitle={t('curatorDashboard.topCropsSub')}>
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
      <ChartCard title={t('curatorDashboard.quickActionsTitle')} subtitle={t('curatorDashboard.quickActionsSub')}>
        <div className="grid gap-3 md:grid-cols-2 pt-1">
          <Link
            to="/reviews"
            className="flex items-center justify-between rounded-md border border-border-subtle p-3 text-xs sm:text-xs sm:text-sm font-medium hover:bg-surface-variant transition-colors group"
          >
            <span className="flex items-center gap-3">
              <CheckSquare className="h-4 w-4 text-primary" />
              {t('curatorDashboard.actionReviewQueue')}
            </span>
            {queue.total > 0 ? (
              <Badge variant="destructive">{formatNumber(queue.total)}</Badge>
            ) : (
              <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-text transition-colors" />
            )}
          </Link>
          <Link
            to="/questions"
            className="flex items-center justify-between rounded-md border border-border-subtle p-3 text-xs sm:text-xs sm:text-sm font-medium hover:bg-surface-variant transition-colors group"
          >
            <span className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-primary" />
              {t('curatorDashboard.actionAllQuestions')}
            </span>
            <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-text transition-colors" />
          </Link>
        </div>
      </ChartCard>
    </div>
  )
}