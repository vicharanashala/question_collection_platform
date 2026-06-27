import { formatNumber } from '@/lib/utils'

interface DataPoint {
  name: string
  value: number
  secondary?: number
}

interface BulletChartComponentProps {
  data: DataPoint[]
  height?: number
  primaryColor?: string
  secondaryColor?: string
  valueFormatter?: (v: number) => string
  showSecondary?: boolean
}

/**
 * Ranked horizontal bullet bars — each row shows:
 * rank | name | primary bar + secondary marker | value
 *
 * Layout: vertical list, bars sized relative to max value.
 * Always renders correctly — pure Tailwind, no SVG fill issues.
 */
export function BulletChartComponent({
  data,
  height = 220,
  primaryColor = 'bg-[hsl(var(--chart-2))]',
  secondaryColor = 'bg-[hsl(var(--primary))]',
  valueFormatter = (v) => formatNumber(v),
  showSecondary = false,
}: BulletChartComponentProps) {
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="flex flex-col" style={{ height }}>
      {data.slice(0, Math.ceil(height / 36)).map((d, i) => {
        const pct = (d.value / max) * 100
        const secondaryPct = d.secondary != null ? (d.secondary / max) * 100 : 0

        return (
          <div
            key={d.name}
            className="flex items-center gap-2 py-1.5 min-w-0"
            style={{ height: 36 }}
          >
            {/* Rank */}
            <span className="w-5 text-right text-xs font-mono text-text-tertiary shrink-0">
              {i + 1}
            </span>

            {/* Name */}
            <span
              className="w-20 truncate text-xs font-medium text-text shrink-0"
              title={d.name}
            >
              {d.name}
            </span>

            {/* Bullet track + bars */}
            <div className="relative flex-1 h-2 rounded-full bg-[hsl(var(--surface-variant))] overflow-hidden">
              {/* Primary bar */}
              <div
                className={`absolute left-0 top-0 h-full rounded-full ${primaryColor}`}
                style={{ width: `${pct}%` }}
              />
              {/* Secondary marker */}
              {showSecondary && d.secondary != null && (
                <div
                  className={`absolute top-0 w-0.5 h-full ${secondaryColor}`}
                  style={{ left: `${secondaryPct}%` }}
                />
              )}
            </div>

            {/* Value label */}
            <span className="w-10 text-right text-xs font-semibold text-text shrink-0 tabular-nums">
              {valueFormatter(d.value)}
            </span>
          </div>
        )
      })}

      {data.length === 0 && (
        <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
          No data available
        </div>
      )}
    </div>
  )
}