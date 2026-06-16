import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChartCard } from '@/components/charts/ChartCard'
import { AreaChartComponent } from '@/components/charts/AreaChartComponent'
import { DonutChartComponent } from '@/components/charts/DonutChartComponent'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { cn, formatDate, formatNumber, calcDelta } from '@/lib/utils'
import {
  Users, MessageSquare, CheckCircle, AlertTriangle, Ban,
  TrendingUp, TrendingDown, Minus, ArrowRight,
  ShieldCheck, Clock, Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AdminStats, TimeRange, DailyStat } from '@/types'
import { format, parseISO } from 'date-fns'



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
  const trendColor = isNeutral ? 'text-muted-foreground' : isPositive ? 'text-success' : 'text-destructive'

  const iconVariant = variant ?? 'primary'

  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{label}</p>
            <p className="mt-1 text-3xl font-extrabold text-foreground tabular-nums">
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
                {sub && <span className="text-xs text-muted-foreground truncate">{sub}</span>}
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

// ─── Period comparison helper ──────────────────────────────────────────────────

function sumField(data: DailyStat[], field: keyof DailyStat, from: number, to: number): number {
  return data.slice(from, to + 1).reduce((s, d) => s + ((d[field] as number) ?? 0), 0)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const TIME_RANGES: { value: TimeRange; label: string; days: number }[] = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
  { value: '90d', label: '90 days', days: 90 },
]

export function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load dashboard')))
      .finally(() => setLoading(false))
  }, [])

  const historical = useMemo(() => {
    return stats?.historical ?? []
  }, [stats])

  const rangeDays = TIME_RANGES.find((r) => r.value === timeRange)?.days ?? 30
  const halfLen = Math.floor(historical.length / 2)
  const midPoint = Math.floor(halfLen)
  const currPeriod = sumField(historical, 'signups', midPoint, historical.length - 1)

  const d = stats?.dashboard
  const userGrowth = calcDelta(
    sumField(historical, 'users', historical.length - rangeDays, historical.length - 1),
    sumField(historical, 'users', historical.length - rangeDays * 2, historical.length - rangeDays - 1),
  )
  const questionGrowth = calcDelta(
    sumField(historical, 'questions', historical.length - rangeDays, historical.length - 1),
    sumField(historical, 'questions', historical.length - rangeDays * 2, historical.length - rangeDays - 1),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  // Area chart: user & question trend for selected period
  const chartData = historical.slice(historical.length - rangeDays).map((s) => ({
    date: s.date,
    Users: s.users,
    Questions: s.questions,
    Signups: s.signups,
  }))

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

  // Bar: question status breakdown
  const qStatusData = [
    { name: 'Pending', value: d?.pendingQuestions ?? 0, color: 'hsl(var(--warning))' },
    { name: 'Approved', value: d?.approvedQuestions ?? 0, color: 'hsl(160, 84%, 39%)' },
    { name: 'Rejected', value: d?.rejectedQuestions ?? 0, color: 'hsl(var(--destructive))' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">
            Welcome back, {user?.name || 'Admin'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Here's your platform overview for the past{' '}
            {TIME_RANGES.find((r) => r.value === timeRange)?.label}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm">
          {TIME_RANGES.map((r) => (
            <Button
              key={r.value}
              variant={timeRange === r.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimeRange(r.value)}
              className={cn('h-7 text-xs', timeRange !== r.value && 'text-muted-foreground')}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={d?.totalUsers ?? 0}
          change={userGrowth}
          sub={`+${currPeriod} new signups`}
          variant="primary"
        />
        <StatCard
          icon={CheckCircle}
          label="Verified Users"
          value={d?.verifiedUsers ?? 0}
          sub={`${d?.pendingUsers ?? 0} pending review`}
          variant="success"
        />
        <StatCard
          icon={MessageSquare}
          label="Total Questions"
          value={d?.totalQuestions ?? 0}
          change={questionGrowth}
          sub={`+${sumField(historical, 'questions', historical.length - rangeDays, historical.length - 1)} this period`}
          variant="info"
        />
        <StatCard
          icon={CheckCircle}
          label="Approved Questions"
          value={d?.approvedQuestions ?? 0}
          sub={`${d?.rejectedQuestions ?? 0} rejected`}
          variant="success"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={AlertTriangle}
          label="Suspended"
          value={d?.suspendedUsers ?? 0}
          variant="warning"
        />
        <StatCard
          icon={Ban}
          label="Banned"
          value={d?.bannedUsers ?? 0}
          variant="danger"
        />
        <StatCard
          icon={Clock}
          label="Pending Questions"
          value={d?.pendingQuestions ?? 0}
          variant="warning"
        />
        <StatCard
          icon={Activity}
          label="Questions This Week"
          value={d?.questionsThisWeek ?? 0}
          sub={`+${d?.usersThisWeek ?? 0} users`}
          variant="info"
        />
      </div>

      {/* Charts row 1: Trends + Question breakdown */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="User & Question Trends"
          subtitle="Growth over selected period"
          action={
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Users
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(199,89%,48%)]" /> Questions
              </span>
            </div>
          }
        >
          <AreaChartComponent
            data={chartData}
            dataKey="Users"
            color="hsl(var(--primary))"
            gradientId="userTrend"
            height={240}
            valueFormatter={(v) => formatNumber(v)}
          />
          <div className="px-1 pb-4" />
          <AreaChartComponent
            data={chartData}
            dataKey="Questions"
            color="hsl(199, 89%, 48%)"
            gradientId="questionTrend"
            height={120}
            showAxis={false}
            showGrid={false}
            valueFormatter={(v) => formatNumber(v)}
          />
        </ChartCard>

        <ChartCard title="Questions by Status" subtitle="Current distribution">
          <BarChartComponent
            data={qStatusData.map((d) => ({ name: d.name, value: d.value }))}
            dataKey="value"
            color="hsl(var(--primary))"
            height={260}
            valueFormatter={(v) => formatNumber(v)}
          />
        </ChartCard>
      </div>

      {/* Charts row 2: Role + Category donuts */}
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
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              No role data available
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Users by Category"
          subtitle="Farmer, FPO, Student, Volunteer, NGO"
        >
          {categoryDonut.length > 0 ? (
            <DonutChartComponent
              data={categoryDonut}
              height={240}
              innerRadius={65}
              outerRadius={100}
            />
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              No category data available
            </div>
          )}
        </ChartCard>
      </div>

      {/* Signup trend bar chart */}
      <ChartCard
        title="Daily Signups"
        subtitle="New user registrations per day"
      >
        <BarChartComponent
          data={chartData.map((d) => ({ name: d.date, value: d.Signups }))}
          dataKey="value"
          color="hsl(160, 84%, 39%)"
          height={180}
          valueFormatter={(v) => formatNumber(v)}
          labelFormatter={(d) => {
            try { return format(parseISO(d), 'MMM d') } catch { return d }
          }}
        />
      </ChartCard>

      {/* Quick actions + Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Quick Actions" subtitle="Navigate the platform">
            <div className="space-y-2 pt-1">
              <Link
                to="/users"
                className="flex items-center justify-between rounded-md border p-3 text-sm font-medium hover:bg-accent transition-colors group"
              >
                <span className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-primary" />
                  View all users
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
              <Link
                to="/questions"
                className="flex items-center justify-between rounded-md border p-3 text-sm font-medium hover:bg-accent transition-colors group"
              >
                <span className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Manage questions
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
              <Link
                to="/reviews"
                className="flex items-center justify-between rounded-md border p-3 text-sm font-medium hover:bg-accent transition-colors group"
              >
                <span className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Review queue
                </span>
                {d?.pendingQuestions ? (
                  <Badge variant="destructive" className="ml-2">{d.pendingQuestions}</Badge>
                ) : (
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                )}
              </Link>
            </div>
          </ChartCard>

        <Card className="shadow-sm lg:col-span-2">
          <ChartCard title="Recent Activity" subtitle="Latest actions on the platform">
            <div className="space-y-3 max-h-56 overflow-y-auto">
              {(stats?.recentActivity ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No recent activity</p>
              ) : (
                stats.recentActivity.slice(0, 10).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground leading-snug">{entry.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {entry.performedBy} &middot;{' '}
                        {formatDate(entry.performedAt) ?? new Date(entry.performedAt).toLocaleDateString('en-IN')}
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