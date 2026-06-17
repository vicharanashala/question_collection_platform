import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
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
  'hsl(var(--success))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
]

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number }> }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-3 py-2 shadow-md">
      <p className="text-xs text-text-secondary">{name}</p>
      <p className="mt-0.5 text-sm font-bold text-text">{value?.toLocaleString()}</p>
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
            <span className="text-xl font-extrabold text-text">
              {typeof centerValue === 'number' ? centerValue.toLocaleString() : centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-xs text-text-secondary">{centerLabel}</span>
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
                  <span className="text-text capitalize">{segment.name.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">{pct}%</span>
                  <span className="font-semibold text-text">{segment.value.toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}