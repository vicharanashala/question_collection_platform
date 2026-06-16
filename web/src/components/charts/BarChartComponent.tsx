import {
  BarChart as RechartsBar,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts'
import { cn } from '@/lib/utils'

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
  labelFormatter?: (d: string) => string
  layout?: 'vertical' | 'horizontal'
  showAxis?: boolean
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
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={layout === 'horizontal'} />}
        {showAxis && (
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            type={layout === 'vertical' ? 'number' : 'category'}
          />
        )}
        {showAxis && (
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            type={layout === 'vertical' ? 'category' : 'number'}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          />
        )}
        <Tooltip
          content={<CustomTooltip valueFormatter={valueFormatter} labelFormatter={labelFormatter} />}
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
        />
        <Bar
          dataKey={dataKey}
          fill={color}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
          unit=""
        />
      </RechartsBar>
    </ResponsiveContainer>
  )
}