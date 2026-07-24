/**
 * Finance Dashboard — Financial Operations Focused
 * Role: finance
 *
 * Fetches ONLY finance-appropriate data:
 *   - getFinancialSummary (wallet balance, payout totals, withdrawal stats)
 *   - NO getStats(), NO getDashboard(), NO user verification data
 *
 * Excludes: user management, question review, audit logs.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChartCard } from '@/components/charts/ChartCard'
import { AreaChartComponent } from '@/components/charts/AreaChartComponent'
import { BarChartComponent } from '@/components/charts/BarChartComponent'
import { DashboardSkeleton } from '@/components/ui/skeleton'
import { cn, formatNumber, formatINR } from '@/lib/utils'
import {
  IndianRupee, Clock, CheckCircle, Ban, TrendingUp, TrendingDown,
  Minus, ArrowRight, Wallet, Activity, AlertTriangle, CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── StatCard (same pattern as main dashboard) ────────────────────────────────

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

// ─── Types for finance summary ─────────────────────────────────────────────────

interface FinSummary {
  totalPaidOut: number
  pendingWithdrawals: { count: number; amount: number }
  completedWithdrawals: { count: number; amount: number }
  failedWithdrawals: { count: number }
  totalWalletBalance: number
  today: { payoutCount: number; payoutAmount: number }
  dailyPayoutTrend: Array<{ date: string; count: number; amount: number }>
}

// ─── Time ranges ───────────────────────────────────────────────────────────────

const TIME_RANGES: { value: string; label: string; days: number }[] = [
  { value: '7d', label: '7D', days: 7 },
  { value: '30d', label: '30D', days: 30 },
  { value: '90d', label: '90D', days: 90 },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

export function FinanceDashboardPage() {
  const { user } = useAuth()
  const [timeRange, setTimeRange] = useState('30d')
  const [finSummary, setFinSummary] = useState<FinSummary | null>(null)
  const [finLoading, setFinLoading] = useState(true)

  const days = TIME_RANGES.find((r) => r.value === timeRange)?.days ?? 30

  useEffect(() => {
    adminApi.getFinancialSummary({ days })
      .then(setFinSummary)
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load financial summary')))
      .finally(() => setFinLoading(false))
  }, [days])

  if (finLoading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-text">
            Financial Overview
          </h2>
          <p className="text-sm text-text-tertiary">
            Wallet &amp; withdrawal analytics · {TIME_RANGES.find((r) => r.value === timeRange)?.label} period
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

      {/* Primary financial cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={IndianRupee}
          label="Total Paid Out"
          value={`₹${formatINR(finSummary?.totalPaidOut ?? 0)}`}
          variant="success"
        />
        <StatCard
          icon={Clock}
          label="Pending Withdrawals"
          value={finSummary?.pendingWithdrawals.count ?? 0}
          sub={`₹${formatINR(finSummary?.pendingWithdrawals.amount ?? 0)}`}
          variant="warning"
        />
        <StatCard
          icon={Wallet}
          label="Total Wallet Balance"
          value={`₹${formatINR(finSummary?.totalWalletBalance ?? 0)}`}
          variant="primary"
        />
        <StatCard
          icon={CheckCircle}
          label="Completed Withdrawals"
          value={finSummary?.completedWithdrawals.count ?? 0}
          sub={`₹${formatINR(finSummary?.completedWithdrawals.amount ?? 0)}`}
          variant="success"
        />
      </div>

      {/* Secondary financial cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Activity}
          label="Today's Payouts"
          value={finSummary?.today.payoutCount ?? 0}
          sub={`₹${formatINR(finSummary?.today.payoutAmount ?? 0)}`}
          variant="info"
        />
        <StatCard
          icon={Ban}
          label="Failed Withdrawals"
          value={finSummary?.failedWithdrawals.count ?? 0}
          variant="danger"
        />
        <StatCard
          icon={AlertTriangle}
          label="Pending Amount"
          value={`₹${formatINR(finSummary?.pendingWithdrawals.amount ?? 0)}`}
          variant="warning"
        />
        <StatCard
          icon={TrendingUp}
          label="Total Rewarded"
          value={`₹${formatINR((finSummary?.totalPaidOut ?? 0) + (finSummary?.pendingWithdrawals.amount ?? 0))}`}
          variant="primary"
        />
      </div>

      {/* Daily payout trend */}
      <ChartCard
        title="Daily Payout Trend"
        subtitle={`Last ${days} days`}
        action={
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Count
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" /> Amount
            </span>
          </div>
        }
      >
        {finSummary?.dailyPayoutTrend && finSummary.dailyPayoutTrend.length > 0 ? (
          <>
            <AreaChartComponent
              data={finSummary.dailyPayoutTrend.map((v) => ({
                date: v.date,
                Count: v.count,
                Amount: v.amount,
              }))}
              dataKey="Amount"
              color="hsl(var(--success))"
              gradientId="finPayoutTrend"
              height={200}
              valueFormatter={(v) => formatNumber(v)}
            />
            <div className="flex gap-6 mt-2 px-1 pb-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                Count: {formatNumber(finSummary.dailyPayoutTrend.reduce((s, v) => s + v.count, 0))}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
                Total: ₹{formatINR(finSummary.dailyPayoutTrend.reduce((s, v) => s + v.amount, 0))}
              </span>
            </div>
          </>
        ) : (
          <div className="h-56 flex items-center justify-center text-sm text-text-tertiary">
            No payout data available
          </div>
        )}
      </ChartCard>

      {/* Quick access nav */}
      <ChartCard title="Quick Access" subtitle="Navigate the platform">
        <div className="grid gap-3 md:grid-cols-3 pt-1">
          <Link
            to="/users"
            className="flex items-center justify-between rounded-md border border-border-subtle p-3 text-sm font-medium hover:bg-surface-variant transition-colors group"
          >
            <span className="flex items-center gap-3">
              <IndianRupee className="h-4 w-4 text-primary" />
              View all users
            </span>
            <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-text transition-colors" />
          </Link>
          <Link
            to="/withdrawals"
            className="flex items-center justify-between rounded-md border border-border-subtle p-3 text-sm font-medium hover:bg-surface-variant transition-colors group"
          >
            <span className="flex items-center gap-3">
              <CreditCard className="h-4 w-4 text-primary" />
              {finSummary?.pendingWithdrawals.count
                ? `${finSummary.pendingWithdrawals.count} pending withdrawals`
                : 'Withdrawals'}
            </span>
            <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-text transition-colors" />
          </Link>
          <Link
            to="/wallets"
            className="flex items-center justify-between rounded-md border border-border-subtle p-3 text-sm font-medium hover:bg-surface-variant transition-colors group"
          >
            <span className="flex items-center gap-3">
              <Wallet className="h-4 w-4 text-primary" />
              All wallets
            </span>
            <ArrowRight className="h-4 w-4 text-text-tertiary group-hover:text-text transition-colors" />
          </Link>
        </div>
      </ChartCard>
    </div>
  )
}

