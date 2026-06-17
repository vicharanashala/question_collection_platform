import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, analyticsApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartCard } from '@/components/charts/ChartCard'
import { AreaChartComponent } from '@/components/charts/AreaChartComponent'
import { DonutChartComponent } from '@/components/charts/DonutChartComponent'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { DashboardSkeleton } from '@/components/ui/skeleton'
import { cn, formatNumber, formatINR } from '@/lib/utils'
import { format, parseISO } from 'date-fns'
import {
  Users, MessageSquare, CheckCircle, AlertTriangle, Ban,
  TrendingUp, TrendingDown, Minus, ArrowRight, Download,
  ShieldCheck, Clock, Activity, BarChart3, PieChart,
  IndianRupee, MapPin, Sparkles, DownloadCloud,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AdminStats, TimeRange, AnalyticsDashboard, ExportParams } from '@/types'

// ─── StatCard with trend ───────────────────────────────────────────────────────

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

// ─── Export Panel ─────────────────────────────────────────────────────────────

interface ExportPanelProps {
  disabled?: boolean
}

function ExportPanel({ disabled }: ExportPanelProps) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [dataType, setDataType] = useState<ExportParams['dataType']>('questions')
  const [format, setFormat] = useState<'csv' | 'excel'>('csv')

  const handleExport = async () => {
    setExporting(true)
    try {
      if (format === 'csv') {
        await analyticsApi.downloadCSV({ dataType, format: 'csv' })
      } else {
        await analyticsApi.downloadExcel({ dataType, format: 'excel' })
      }
      toast.success(`Exporting ${dataType} as ${format.toUpperCase()}…`)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Export failed'))
    } finally {
      setExporting(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
      >
        <DownloadCloud className="h-4 w-4" />
        Export
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <Card className="absolute right-0 top-12 z-20 w-72 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Export Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Data Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['questions', 'users', 'rewards', 'withdrawals'] as const).map((t) => (
                    <Button
                      key={t}
                      variant={dataType === t ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs capitalize"
                      onClick={() => setDataType(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-text-secondary mb-1.5 block">Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['csv', 'excel'] as const).map((f) => (
                    <Button
                      key={f}
                      variant={format === f ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs uppercase"
                      onClick={() => setFormat(f)}
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full gap-2"
                size="sm"
                onClick={handleExport}
                disabled={exporting}
              >
                <Download className="h-4 w-4" />
                {exporting ? 'Preparing…' : `Download ${format.toUpperCase()}`}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ─── Period helper ─────────────────────────────────────────────────────────────

const TIME_RANGES: { value: TimeRange; label: string; days: number }[] = [
  { value: '7d', label: '7D', days: 7 },
  { value: '30d', label: '30D', days: 30 },
  { value: '90d', label: '90D', days: 90 },
]

function timeRangeDays(tr: TimeRange) {
  return TIME_RANGES.find((r) => r.value === tr)?.days ?? 30
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [tab, setTab] = useState<'questions' | 'users' | 'rewards'>('questions')

  // Load both legacy stats and new analytics in parallel
  useEffect(() => {
    Promise.all([
      adminApi.getStats().catch((e) => {
        toast.error(getErrorMessage(e, 'Failed to load stats'))
        return null
      }),
      analyticsApi.getDashboard().catch((e) => {
        toast.error(getErrorMessage(e, 'Failed to load analytics'))
        return null
      }),
    ])
      .then(([s, a]) => {
        if (s) setStats(s)
        if (a) setAnalytics(a)
      })
      .finally(() => {
        setLoading(false)
        setAnalyticsLoading(false)
      })
  }, [])

  const rangeDays = timeRangeDays(timeRange)
  const d = stats?.dashboard

  const days = rangeDays

  // ── Derived: analytics sub-data ────────────────────────────────────────────
  const qAnalytics = analytics?.questions
  const uAnalytics = analytics?.users
  const rAnalytics = analytics?.rewards

  // Donut: role distribution
  const roleDonut = (stats?.roleDistribution ?? []).map(({ role, count }) => ({
    name: role,
    value: count,
  }))

  // Donut: category distribution
  const categoryDonut = (stats?.categoryDistribution ?? []).map(({ category, count }) => ({
    name: category,
    value: count,
  }))

  // Question status bar
  const qStatusData = [
    { name: 'Pending', value: qAnalytics?.summary.pending ?? d?.pendingQuestions ?? 0 },
    { name: 'Approved', value: qAnalytics?.summary.approved ?? d?.approvedQuestions ?? 0 },
    { name: 'Rejected', value: qAnalytics?.summary.rejected ?? d?.rejectedQuestions ?? 0 },
  ]

  // State breakdown bar (top 8)
  const stateBarData = (qAnalytics?.stateBreakdown ?? []).slice(0, 8).map((s) => ({
    name: s.state,
    value: s.count,
  }))

  // Crop breakdown donut
  const cropDonutData = (qAnalytics?.cropBreakdown ?? []).slice(0, 7).map((c) => ({
    name: c.cropType,
    value: c.count,
  }))

  // Domain breakdown
  const domainBarData = (qAnalytics?.domainBreakdown ?? []).slice(0, 8).map((d_) => ({
    name: d_.domain,
    value: d_.count,
  }))

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-text">
            Welcome back, {user?.name || 'Admin'}
          </h2>
          <p className="text-sm text-text-tertiary">
            Platform overview · {TIME_RANGES.find((r) => r.value === timeRange)?.label} period
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <ExportPanel />
        </div>
      </div>

      {/* ── Primary metric cards ───────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Registered Users"
          value={analytics?.totalRegisteredUsers ?? d?.totalUsers ?? 0}
          sub={`${analytics?.monthlyActiveUsers ?? 0} MAU`}
          variant="primary"
        />
        <StatCard
          icon={MessageSquare}
          label="Total Approved Questions"
          value={analytics?.totalApprovedQuestions ?? d?.approvedQuestions ?? 0}
          change={analytics?.datasetGrowthRate}
          sub={`${analytics?.stateParticipationRate ?? 0}% state coverage`}
          variant="info"
        />
        <StatCard
          icon={CheckCircle}
          label="Verified Users"
          value={d?.verifiedUsers ?? 0}
          sub={`${d?.pendingUsers ?? 0} pending review`}
          variant="success"
        />
        <StatCard
          icon={TrendingUp}
          label="Questions This Week"
          value={d?.questionsThisWeek ?? 0}
          sub={`+${d?.usersThisWeek ?? 0} new users`}
          variant="success"
        />
      </div>

      {/* ── Secondary metric cards ─────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={IndianRupee}
          label="Cost per Approved Question"
          value={analytics?.costPerApprovedQuestion != null ? `₹${analytics.costPerApprovedQuestion.toFixed(2)}` : '—'}
          sub={analytics ? `₹${formatINR(analytics.totalRewarded)} total rewarded` : undefined}
          variant="warning"
        />
        <StatCard
          icon={MapPin}
          label="State Participation"
          value={`${analytics?.stateParticipationRate ?? 0}%`}
          sub={`${uAnalytics?.totalUsers ?? 0} total users`}
          variant="info"
        />
        <StatCard
          icon={Sparkles}
          label="Avg AI Confidence"
          value={analytics?.avgQuestionQualityScore != null ? `${analytics.avgQuestionQualityScore}%` : '—'}
          sub={`${qAnalytics?.summary.approvalRate ?? 0}% approval rate`}
          variant="success"
        />
        <StatCard
          icon={Clock}
          label="Pending Questions"
          value={d?.pendingQuestions ?? 0}
          variant="warning"
        />
      </div>

      {/* ── Charts row 1: Question trends + Status breakdown ────────────────── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Daily Question Volume"
          subtitle={`Last ${days} days`}
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
          {analyticsLoading ? (
            <div className="h-56 flex items-center justify-center text-sm text-text-tertiary">
              Loading…
            </div>
          ) : qAnalytics?.dailyVolume.length ? (
            <>
              <AreaChartComponent
                data={qAnalytics.dailyVolume.map((v) => ({ date: v.date, Submitted: v.submitted, Approved: v.approved, Rejected: v.rejected }))}
                dataKey="Submitted"
                color="hsl(var(--primary))"
                gradientId="qTrend"
                height={200}
                valueFormatter={(v) => formatNumber(v)}
              />
              <div className="flex gap-6 mt-2 px-1 pb-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
                  Approved: {formatNumber(qAnalytics.summary.approved)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive inline-block" />
                  Rejected: {formatNumber(qAnalytics.summary.rejected)}
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
            data={qStatusData.map((d_) => ({ name: d_.name, value: d_.value }))}
            dataKey="value"
            color="hsl(var(--primary))"
            height={260}
            valueFormatter={(v) => formatNumber(v)}
          />
        </ChartCard>
      </div>

      {/* ── Charts row 2: State breakdown + Crop donut ──────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Top States by Volume" subtitle="Questions submitted per state">
          <BarChartComponent
            data={stateBarData}
            dataKey="value"
            color="hsl(var(--chart-2))"
            height={220}
            layout="vertical"
            valueFormatter={(v) => formatNumber(v)}
          />
        </ChartCard>

        <ChartCard title="Top Crops" subtitle="Question distribution by crop type">
          {cropDonutData.length > 0 ? (
            <DonutChartComponent
              data={cropDonutData}
              height={220}
              innerRadius={55}
              outerRadius={90}
            />
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-text-tertiary">
              No crop data available
            </div>
          )}
        </ChartCard>

        <ChartCard title="Questions by Domain" subtitle="Subject area breakdown">
          <BarChartComponent
            data={domainBarData}
            dataKey="value"
            color="hsl(var(--warning))"
            height={220}
            layout="vertical"
            valueFormatter={(v) => formatNumber(v)}
          />
        </ChartCard>
      </div>

      {/* ── Analytics tabs: Questions / Users / Rewards ─────────────────────── */}
      <Card className="shadow-xs">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-4">
            <CardTitle className="text-sm">Deep Analytics</CardTitle>
            <div className="flex rounded-lg border border-border-subtle bg-surface p-1">
              {([
                { key: 'questions', label: 'Questions' },
                { key: 'users', label: 'Users' },
                { key: 'rewards', label: 'Rewards' },
              ] as const).map(({ key, label }) => (
                <Button
                  key={key}
                  variant={tab === key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTab(key)}
                  className={cn('h-7 text-xs', tab !== key && 'text-text-tertiary')}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Questions tab */}
          {tab === 'questions' && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                <StatCard icon={MessageSquare} label="Total Submitted" value={qAnalytics?.summary.total ?? 0} variant="primary" />
                <StatCard icon={CheckCircle} label="Approved" value={qAnalytics?.summary.approved ?? 0} variant="success" />
                <StatCard icon={Ban} label="Rejected" value={qAnalytics?.summary.rejected ?? 0} variant="danger" />
                <StatCard icon={Activity} label="Approval Rate" value={`${qAnalytics?.summary.approvalRate ?? 0}%`} variant="success" />
                <StatCard icon={Sparkles} label="Growth Rate" value={`${qAnalytics?.summary.growthRate ?? 0}%`} change={qAnalytics?.summary.growthRate} variant="info" />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="Daily Submission Trend" subtitle="Submitted, approved, rejected">
                  <AreaChartComponent
                    data={(qAnalytics?.dailyVolume ?? []).map((v) => ({ date: v.date, Submitted: v.submitted, Approved: v.approved, Rejected: v.rejected }))}
                    dataKey="Submitted"
                    color="hsl(var(--primary))"
                    gradientId="qTabTrend"
                    height={180}
                    valueFormatter={(v) => formatNumber(v)}
                  />
                </ChartCard>
                <ChartCard title="Domain Category Breakdown" subtitle="Questions per domain">
                  <BarChartComponent
                    data={(qAnalytics?.domainBreakdown ?? []).slice(0, 8).map((d_) => ({ name: d_.domain, value: d_.count }))}
                    dataKey="value"
                    color="hsl(var(--primary))"
                    height={180}
                    valueFormatter={(v) => formatNumber(v)}
                  />
                </ChartCard>
              </div>
            </div>
          )}

          {/* Users tab */}
          {tab === 'users' && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                <StatCard icon={Users} label="Total Users" value={uAnalytics?.totalUsers ?? 0} variant="primary" />
                <StatCard icon={Activity} label="Monthly Active" value={uAnalytics?.mau ?? 0} variant="info" />
                <StatCard icon={Clock} label="Daily Active" value={uAnalytics?.dau ?? 0} variant="warning" />
                <StatCard icon={TrendingUp} label="Signup Growth" value={`${uAnalytics?.signupGrowth ?? 0}%`} change={uAnalytics?.signupGrowth} variant="success" />
                <StatCard icon={CheckCircle} label="Verified" value={d?.verifiedUsers ?? 0} variant="success" />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="Daily Signups & DAU" subtitle="Last 30 days">
                  <AreaChartComponent
                    data={(uAnalytics?.signupTrend ?? []).map((s) => ({ date: s.date, Signups: s.signups, DAU: s.dau }))}
                    dataKey="Signups"
                    color="hsl(var(--success))"
                    gradientId="userTabTrend"
                    height={180}
                    valueFormatter={(v) => formatNumber(v)}
                  />
                </ChartCard>
                <div className="grid grid-cols-2 gap-4">
                  <ChartCard title="Users by Role" subtitle="Platform roles">
                    {roleDonut.length > 0 ? (
                      <DonutChartComponent
                        data={roleDonut}
                        height={180}
                        innerRadius={45}
                        outerRadius={72}
                      />
                    ) : (
                      <div className="h-40 flex items-center justify-center text-sm text-text-tertiary">No data</div>
                    )}
                  </ChartCard>
                  <ChartCard title="Users by Category" subtitle="Farmer, FPO, Student…">
                    {categoryDonut.length > 0 ? (
                      <DonutChartComponent
                        data={categoryDonut}
                        height={180}
                        innerRadius={45}
                        outerRadius={72}
                      />
                    ) : (
                      <div className="h-40 flex items-center justify-center text-sm text-text-tertiary">No data</div>
                    )}
                  </ChartCard>
                </div>
              </div>
            </div>
          )}

          {/* Rewards tab */}
          {tab === 'rewards' && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
                <StatCard icon={IndianRupee} label="Total Rewarded" value={`₹${formatINR(rAnalytics?.totalRewarded ?? 0)}`} variant="success" />
                <StatCard icon={BarChart3} label="Reward Count" value={rAnalytics?.rewardCount ?? 0} variant="info" />
                <StatCard icon={PieChart} label="Avg Reward" value={rAnalytics?.avgReward != null ? `₹${rAnalytics.avgReward.toFixed(1)}` : '—'} variant="warning" />
                <StatCard icon={AlertTriangle} label="Pending Withdrawals" value={rAnalytics?.withdrawals.pending ?? 0} variant="warning" />
                <StatCard icon={CheckCircle} label="Completed Withdrawals" value={rAnalytics?.withdrawals.completed ?? 0} variant="success" />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="Daily Reward Amount" subtitle="₹ credited per day">
                  <AreaChartComponent
                    data={(rAnalytics?.dailyRewardTrend ?? []).map((r) => ({ date: r.date, Amount: r.amount, Count: r.count }))}
                    dataKey="Amount"
                    color="hsl(var(--success))"
                    gradientId="rewardTrend"
                    height={180}
                    valueFormatter={(v) => `₹${formatNumber(v)}`}
                  />
                </ChartCard>
                <ChartCard title="Withdrawal Status" subtitle="Pending, completed, failed">
                  <BarChartComponent
                    data={[
                      { name: 'Pending', value: rAnalytics?.withdrawals.pending ?? 0 },
                      { name: 'Completed', value: rAnalytics?.withdrawals.completed ?? 0 },
                      { name: 'Failed', value: rAnalytics?.withdrawals.failed ?? 0 },
                    ]}
                    dataKey="value"
                    color="hsl(var(--primary))"
                    height={180}
                    valueFormatter={(v) => formatNumber(v)}
                  />
                </ChartCard>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Charts row 3: Role + Category donuts ──────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard
          title="Users by Role"
          subtitle={`${(stats?.roleDistribution ?? []).reduce((s, r) => s + r.count, 0).toLocaleString()} total`}
        >
          {roleDonut.length > 0 ? (
            <DonutChartComponent
              data={roleDonut}
              height={240}
              innerRadius={65}
              outerRadius={100}
              centerValue={d?.totalUsers?.toLocaleString() ?? '—'}
              centerLabel="Total Users"
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-text-tertiary">No role data</div>
          )}
        </ChartCard>

        <ChartCard title="Users by Category" subtitle="Farmer, FPO, Student, Volunteer, NGO">
          {categoryDonut.length > 0 ? (
            <DonutChartComponent
              data={categoryDonut}
              height={240}
              innerRadius={65}
              outerRadius={100}
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-text-tertiary">No category data</div>
          )}
        </ChartCard>
      </div>

      {/* ── Quick actions + Recent Activity ────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Quick Actions" subtitle="Navigate the platform">
          <div className="space-y-2 pt-1">
            <Link
              to="/users"
              className="flex items-center justify-between rounded-md border border-border-subtle p-3 text-sm font-medium hover:bg-surface-variant transition-colors group"
            >
              <span className="flex items-center gap-3">
                <Users className="h-4 w-4 text-primary" />
                View all users
              </span>
              <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-text transition-colors" />
            </Link>
            <Link
              to="/questions"
              className="flex items-center justify-between rounded-md border border-border-subtle p-3 text-sm font-medium hover:bg-surface-variant transition-colors group"
            >
              <span className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-primary" />
                Manage questions
              </span>
              <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-text transition-colors" />
            </Link>
            <Link
              to="/reviews"
              className="flex items-center justify-between rounded-md border border-border-subtle p-3 text-sm font-medium hover:bg-surface-variant transition-colors group"
            >
              <span className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Review queue
              </span>
              {d?.pendingQuestions ? (
                <Badge variant="destructive">{d.pendingQuestions}</Badge>
              ) : (
                <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-text transition-colors" />
              )}
            </Link>
          </div>
        </ChartCard>

        <Card className="shadow-xs lg:col-span-2">
          <ChartCard title="Recent Activity" subtitle="Latest platform actions">
            <div className="space-y-3 max-h-56 overflow-y-auto">
              {(stats?.recentActivity ?? []).length === 0 ? (
                <p className="text-sm text-text-tertiary py-4 text-center">No recent activity</p>
              ) : (
                (stats?.recentActivity ?? []).slice(0, 10).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-text leading-snug">{entry.description}</p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {entry.performedBy} &middot;{' '}
                        {entry.performedAt
                          ? format(parseISO(entry.performedAt), 'MMM d, h:mm a')
                          : entry.performedAt}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ChartCard>
        </Card>
      </div>
    </div>
  )
}