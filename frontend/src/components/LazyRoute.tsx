/**
 * LazyRoute — wraps React.lazy + Suspense with a SkeletonPage fallback.
 * Keeps the Suspense boundary colocated with the route, so each page
 * chunk is only loaded when the route is first visited.
 */
import { lazy, Suspense } from 'react'
import { SkeletonPage } from '@/components/ui/skeleton'

interface LazyOptions {
  fallback?: React.ReactNode
}

export function lazyRoute<T extends React.ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  opts: LazyOptions = {},
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = lazy(importFn) as React.ComponentType<any>
  const fallback = opts.fallback ?? <SkeletonPage />

  return function LazyRoute() {
    return (
      <Suspense fallback={fallback}>
        <Component />
      </Suspense>
    )
  }
}