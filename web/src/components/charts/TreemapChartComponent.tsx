import { Treemap, Tooltip, ResponsiveContainer } from 'recharts'
import { formatNumber } from '@/lib/utils'

interface TreemapDataPoint {
  name: string
  value: number
  fill?: string
}

interface TreemapChartComponentProps {
  data: TreemapDataPoint[]
  height?: number
  valueFormatter?: (v: number) => string
}

const CHART_COLORS = [
  'hsl(199 89% 48%)',   // chart-2 sky blue
  'hsl(173 58% 39%)',   // primary teal
  'hsl(263 70% 50%)',   // chart-3 purple
  'hsl(33 93% 54%)',    // chart-4 orange
  'hsl(160 84% 39%)',   // chart-5 green
  'hsl(38 92% 50%)',    // warning amber
  'hsl(166 76% 55%)',   // primary light
  'hsl(220 14% 60%)',   // muted
  'hsl(0 72% 51%)',     // destructive
  'hsl(199 89% 60%)',   // chart-2 dark
]

interface CustomContentProps {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  value?: number
  fill?: string
  index?: number
}

function CustomTreemapContent(props: CustomContentProps) {
  const { x = 0, y = 0, width = 0, height = 0, name, value, fill } = props
  if (width < 30 || height < 20) return null

  const fontSize = width > 80 && height > 50 ? 12 : width > 50 ? 10 : 9
  const showLabel = width > 50 && height > 35
  const showValue = width > 60 && height > 50

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={0.85 + (props.index ?? 0) * 0.015}
        rx={4}
        ry={4}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showValue ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="hsl(var(--background))"
          fontSize={fontSize}
          fontWeight={600}
          style={{ pointerEvents: 'none' }}
        >
          {width > 100 ? name : name?.substring(0, 10)}
        </text>
      )}
      {showValue && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="hsl(var(--background))"
          fontSize={10}
          fontWeight={400}
          fillOpacity={0.85}
          style={{ pointerEvents: 'none' }}
        >
          {value?.toLocaleString()}
        </text>
      )}
    </g>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload as TreemapDataPoint | undefined
  if (!d) return null
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-text">{d.name}</p>
      <p className="mt-0.5 text-sm font-bold text-text">
        {d.value?.toLocaleString()}
      </p>
    </div>
  )
}

export function TreemapChartComponent({
  data,
  height = 220,
  valueFormatter = (v) => formatNumber(v),
}: TreemapChartComponentProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-text-tertiary" style={{ height }}>
        No district data available
      </div>
    )
  }

  const mapped = data.map((d, i) => ({
    ...d,
    fill: d.fill ?? CHART_COLORS[i % CHART_COLORS.length],
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={mapped}
        dataKey="value"
        content={<CustomTreemapContent />}
        stroke="hsl(var(--background))"
      >
        <Tooltip content={<CustomTooltip />} />
      </Treemap>
    </ResponsiveContainer>
  )
}