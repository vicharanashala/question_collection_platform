import { formatNumber } from '@/lib/utils'

interface DataPoint {
  name: string
  value: number
}

interface RankedBarListProps {
  data: DataPoint[]
  height?: number
  color?: string
  showPercentage?: boolean
  valueFormatter?: (v: number) => string
}

/**
 * A clean ranked list with inline horizontal bars — no chart library needed.
 * Renders as a scrollable list of rows: rank | name | bar | value | pct.
 * Works for any categorical breakdown (crops, domains, etc.).
 */
export function RankedBarList({
  data,
  height = 220,
  color = 'hsl(var(--primary))',
  showPercentage = true,
  valueFormatter = (v) => formatNumber(v),
}: RankedBarListProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const max = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="flex flex-col overflow-hidden" style={{ height }}>
      {data.slice(0, Math.ceil(height / 44)).map((d, i) => {
        const pct = (d.value / max) * 100
        const sharePct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0'
        const rowHeight = Math.floor((height - 8) / Math.min(data.length, Math.ceil(height / 44)))

        return (
          <div
            key={d.name}
            className="flex items-center gap-2 py-1 min-w-0"
            style={{ height: rowHeight }}
          >
            {/* Rank badge */}
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{
                backgroundColor: 'hsl(var(--surface-variant))',
                color: 'hsl(var(--text-secondary))',
              }}
            >
              {i + 1}
            </span>

            {/* Name */}
            <span
              className="w-20 truncate text-xs font-medium text-text capitalize shrink-0"
              title={d.name}
            >
              {d.name.replace(/_/g, ' ')}
            </span>

            {/* Bar */}
            <div className="relative flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--surface-variant))' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                }}
              />
            </div>

            {/* Value */}
            <span className="w-10 text-right text-xs font-semibold text-text tabular-nums shrink-0">
              {valueFormatter(d.value)}
            </span>

            {/* Share % */}
            {showPercentage && (
              <span className="w-10 text-right text-[10px] tabular-nums shrink-0" style={{ color: 'hsl(var(--text-tertiary))' }}>
                {sharePct}%
              </span>
            )}
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