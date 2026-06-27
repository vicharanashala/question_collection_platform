import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface BarDataPoint {
  name: string
  [key: string]: string | number
}

interface BarChartComponentProps {
  data: BarDataPoint[]
  dataKey: string
  color?: string
  height?: number
  showGrid?: boolean
  valueFormatter?: (v: number) => string
  labelFormatter?: (l: string) => string
  layout?: 'vertical' | 'horizontal'
  showAxis?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label, valueFormatter, labelFormatter }: { active?: boolean; payload?: any[]; label?: string; valueFormatter?: (v: number) => string; labelFormatter?: (l: string) => string }) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value as number
  const displayLabel = labelFormatter ? labelFormatter(label ?? '') : String(label ?? '')
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-3 py-2 shadow-md">
      <p className="text-xs text-text-secondary">{displayLabel}</p>
      <p className="mt-0.5 text-sm font-bold text-text">
        {valueFormatter ? valueFormatter(value) : value?.toLocaleString()}
      </p>
    </div>
  )
}

export function BarChartComponent({
  data,
  dataKey,
  color = 'hsl(var(--primary))',
  height = 220,
  showGrid = true,
  valueFormatter,
  labelFormatter,
  layout = 'horizontal',
  showAxis = true,
}: BarChartComponentProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar
        data={data}
        layout={layout}
        margin={{ top: 4, right: 4, left: showAxis ? 0 : -20, bottom: 0 }}
      >
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-subtle))" vertical={layout === 'horizontal'} />}
        {showAxis && (
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'hsl(var(--text-tertiary))' }}
            tickLine={false}
            axisLine={false}
            type={layout === 'vertical' ? 'number' : 'category'}
          />
        )}
        {showAxis && (
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--text-tertiary))' }}
            tickLine={false}
            axisLine={false}
            type={layout === 'vertical' ? 'category' : 'number'}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          />
        )}
        <Tooltip
          content={<CustomTooltip valueFormatter={valueFormatter} labelFormatter={labelFormatter} />}
          cursor={{ fill: 'hsl(var(--surface-variant))', opacity: 0.5 }}
        />
        <Bar
          dataKey={dataKey}
          style={{ fill: color }}
          radius={layout === 'vertical' ? [0, 4, 4, 0] : [4, 4, 0, 0]}
          maxBarSize={48}
          unit=""
        />
      </RechartsBar>
    </ResponsiveContainer>
  )
}