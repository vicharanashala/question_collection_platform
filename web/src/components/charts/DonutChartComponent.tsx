import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts'
import { cn } from '@/lib/utils'

interface DonutSegment {
  name: string
  value: number
  color?: string
}

interface DonutChartComponentProps {
  data: DonutSegment[]
  colors?: string[]
  showLegend?: boolean
  centerLabel?: string
  centerValue?: string | number
  height?: number
  innerRadius?: number
  outerRadius?: number
  valueFormatter?: (v: number) => string
}

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(160, 84%, 39%)',
  'hsl(199, 89%, 48%)',
  'hsl(263, 70%, 50%)',
  'hsl(330, 81%, 60%)',
]

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0] as DonutSegment
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{name}</p>
      <p className="mt-0.5 text-sm font-bold text-foreground">{value?.toLocaleString()}</p>
    </div>
  )
}

export function DonutChartComponent({
  data,
  colors = DEFAULT_COLORS,
  showLegend = true,
  centerLabel,
  centerValue,
  height = 220,
  innerRadius = 60,
  outerRadius = 90,
  valueFormatter,
}: DonutChartComponentProps) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPie>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </RechartsPie>
      </ResponsiveContainer>

      {/* Center label */}
      {(centerLabel || centerValue !== undefined) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue !== undefined && (
            <span className="text-xl font-extrabold text-foreground">
              {typeof centerValue === 'number' ? centerValue.toLocaleString() : centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
          )}
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="mt-3 space-y-2">
          {data.map((segment, i) => {
            const pct = total > 0 ? ((segment.value / total) * 100).toFixed(1) : '0'
            return (
              <div key={segment.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full shrink-0')} style={{ backgroundColor: colors[i % colors.length] }} />
                  <span className="text-foreground capitalize">{segment.name.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                  <span className="font-semibold text-foreground">{segment.value.toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}