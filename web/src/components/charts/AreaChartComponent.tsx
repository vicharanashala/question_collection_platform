import {
  AreaChart as RechartsArea,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface DataPoint {
  date: string
  [key: string]: string | number
}

interface AreaChartComponentProps {
  data: DataPoint[]
  dataKey: string
  color?: string
  gradientId?: string
  height?: number
  showGrid?: boolean
  showAxis?: boolean
  valueFormatter?: (v: number) => string
  labelFormatter?: (d: string) => string
}

function CustomTooltip({ active, payload, label, valueFormatter, labelFormatter }: TooltipProps<number, string> & {
  valueFormatter?: (v: number) => string
  labelFormatter?: (d: string) => string
}) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value as number
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{labelFormatter ? labelFormatter(label) : label}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">
        {valueFormatter ? valueFormatter(value) : value?.toLocaleString()}
      </p>
    </div>
  )
}

export function AreaChartComponent({
  data,
  dataKey,
  color = 'hsl(var(--primary))',
  gradientId = 'areaGradient',
  height = 220,
  showGrid = true,
  showAxis = true,
  valueFormatter,
  labelFormatter,
}: AreaChartComponentProps) {
  const cssColor = `var(--primary)`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsArea data={data} margin={{ top: 4, right: 4, left: showAxis ? 0 : -28, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />}
        {showAxis && (
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(d) => {
              try { return format(parseISO(d), 'MMM d') } catch { return d }
            }}
          />
        )}
        {showAxis && (
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          />
        )}
        <Tooltip
          content={<CustomTooltip valueFormatter={valueFormatter} labelFormatter={labelFormatter} />}
          cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </RechartsArea>
    </ResponsiveContainer>
  )
}