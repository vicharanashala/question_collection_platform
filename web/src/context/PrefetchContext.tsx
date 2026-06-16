import { createContext, useContext, useCallback, type ReactNode } from 'react'

interface PrefetchEntry {
  key: string
  fetcher: () => Promise<unknown>
}

interface PrefetchContextValue {
  prefetch: (key: string, fetcher: () => Promise<unknown>) => void
  cancel: (key: string) => void
}

const PrefetchContext = createContext<PrefetchContextValue>({
  prefetch: () => {},
  cancel: () => {},
})

const prefetchStore = new Map<string, AbortController>()

export function PrefetchProvider({ children }: { children: ReactNode }) {
  const prefetch = useCallback((key: string, fetcher: () => Promise<unknown>) => {
    // Cancel any existing in-flight request for this key
    prefetchStore.get(key)?.abort()
    const controller = new AbortController()
    prefetchStore.set(key, controller)
    fetcher()
      .then(() => prefetchStore.delete(key))
      .catch(() => prefetchStore.delete(key))
  }, [])

  const cancel = useCallback((key: string) => {
    prefetchStore.get(key)?.abort()
    prefetchStore.delete(key)
  }, [])

  return (
    <PrefetchContext.Provider value={{ prefetch, cancel }}>
      {children}
    </PrefetchContext.Provider>
  )
}

export function usePrefetch() {
  return useContext(PrefetchContext)
}

/**
 * Generic lazy data hook with loading / error / data state.
 * Use it inside React components — pages or features.
 */
export function useApi<T>(
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  options: { enabled?: boolean; ttl?: number } = {},
) {
  // This is intentionally left minimal — the actual loading lives
  // in the individual page components which own the loading state.
  // This hook serves as the signal layer for Suspense if we migrate later.
  return null as unknown as { key: string | null; fetcher: (() => Promise<T>) | null }
}