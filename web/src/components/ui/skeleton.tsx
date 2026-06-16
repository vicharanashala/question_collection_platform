import { cn } from '@/lib/utils'
import { Card, CardContent } from './card'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-variant', className)}
      {...props}
    />
  )
}

/** Deterministic bar height for chart skeletons — avoids Math.random() which breaks
 *  pure render semantics and causes hydration mismatches. */
function barHeight(index: number): number {
  // Pseudo-random but stable: cycle through 5 distinct heights
  const heights = [45, 70, 55, 85, 60, 90, 50, 75, 65, 95, 40, 80]
  return heights[index % heights.length]
}

// ─── Chart skeleton ─────────────────────────────────────────────────────────

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="flex flex-col gap-3" style={{ height }}>
      <div className="flex items-end gap-2 flex-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1"
            // Use deterministic heights instead of Math.random() to keep renders stable
            style={{ height: `${barHeight(i)}%` }}
          />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  )
}

// ─── Page-level skeletons ───────────────────────────────────────────────────

/** Dashboard page skeleton — mirrors the actual DashboardPage layout. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>

      {/* Stat cards row 1 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Stat cards row 2 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="w-full" style={{ height: 240 }} />
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="w-full" style={{ height: 260 }} />
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="w-full" style={{ height: 240 }} />
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="w-full" style={{ height: 240 }} />
          </CardContent>
        </Card>
      </div>

      {/* Bar chart card */}
      <Card className="shadow-xs">
        <CardContent className="p-5 space-y-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="w-full" style={{ height: 180 }} />
        </CardContent>
      </Card>

      {/* Quick actions + Recent activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-2 pt-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-2 w-2 rounded-full mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2.5 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** User detail page skeleton — mirrors UserDetailPage layout. */
export function UserDetailSkeleton() {
  return (
    <div className="space-y-5">
      {/* Back button */}
      <Skeleton className="h-5 w-32" />

      {/* Hero card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <Skeleton className="h-16 w-16 shrink-0 rounded-2xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex gap-6 pt-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-28" />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="shadow-xs">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-8" />
              </div>
              <Skeleton className="h-5 w-5 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Account + Questions grid */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Account details */}
        <Card className="lg:col-span-2 shadow-xs">
          <CardContent className="p-5 space-y-0">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Questions */}
        <Card className="lg:col-span-3 shadow-xs">
          <CardContent className="p-5">
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-2 w-2 rounded-full mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-4/5" />
                      <div className="flex gap-2 pt-1">
                        <Skeleton className="h-4 w-16 rounded-full" />
                        <Skeleton className="h-4 w-12" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-4 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Settings page skeleton — mirrors SettingsPage layout. */
export function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      {/* Config cards grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="shadow-xs">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-7 w-10 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Reusable primitives ────────────────────────────────────────────────────

/** Renders a matching skeleton that approximates the final layout. */
export function SkeletonPage({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      {/* Content rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border-subtle">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-3 flex-1" />
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  )
}

export { Skeleton }