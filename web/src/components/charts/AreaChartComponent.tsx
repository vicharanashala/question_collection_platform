import {
  AreaChart as RechartsArea,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface DataPoint {
  date: string
  [key: string]: string | number
}

export interface AreaSeries {
  dataKey: string
  color: string
}

interface AreaChartComponentProps {
  data: DataPoint[]
  dataKey: string
  /** When set, draws one area per series (and ignores dataKey/color). */
  series?: AreaSeries[]
  color?: string
  gradientId?: string
  height?: number
  showGrid?: boolean
  showAxis?: boolean
  valueFormatter?: (v: number) => string
  labelFormatter?: (l: string) => string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, valueFormatter, labelFormatter }: { active?: boolean; payload?: any[]; label?: string; valueFormatter?: (v: number) => string; labelFormatter?: (l: string) => string }) {
  if (!active || !payload?.length) return null
  const displayLabel = labelFormatter ? labelFormatter(label ?? '') : String(label ?? '')
  const fmt = (v: number) => (valueFormatter ? valueFormatter(v) : v?.toLocaleString())
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-3 py-2 shadow-md">
      <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">{displayLabel}</p>
      {payload.length === 1 ? (
        <p className="mt-0.5 text-xs sm:text-xs sm:text-sm font-bold text-text">{fmt(payload[0]?.value as number)}</p>
      ) : (
        payload.map((p) => (
          <p key={p.dataKey} className="mt-0.5 flex items-center gap-2 text-xs sm:text-xs sm:text-sm text-text">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke }} />
            <span className="text-text-secondary">{p.dataKey}</span>
            <span className="ml-auto font-bold tabular-nums">{fmt(p.value as number)}</span>
          </p>
        ))
      )}
    </div>
  )
}

export function AreaChartComponent({
  data,
  dataKey,
  series,
  color = 'hsl(var(--primary))',
  gradientId = 'areaGradient',
  height = 220,
  showGrid = true,
  showAxis = true,
  valueFormatter,
  labelFormatter,
}: AreaChartComponentProps) {
  const areas = series ?? [{ dataKey, color }]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsArea data={data} margin={{ top: 4, right: 4, left: showAxis ? 0 : -28, bottom: 0 }}>
        <defs>
          {areas.map((s, i) => (
            <linearGradient key={s.dataKey} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" vertical={false} />}
        {showAxis && (
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--text-tertiary))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(d) => {
              try { return format(parseISO(d), 'MMM d') } catch { return d }
            }}
          />
        )}
        {showAxis && (
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--text-tertiary))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => typeof v === 'number' ? v.toLocaleString() : v}
          />
        )}
        <Tooltip
          content={<CustomTooltip valueFormatter={valueFormatter} labelFormatter={labelFormatter} />}
          cursor={{ stroke: 'hsl(var(--border-subtle))', strokeWidth: 1 }}
        />
        {areas.map((s, i) => (
          <Area
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#${gradientId}-${i})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </RechartsArea>
    </ResponsiveContainer>
  )
}