import { useSyncExternalStore } from 'react'

// Tracks whether a CSS media query matches, updating when the viewport changes.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener('change', onChange)
      return () => mediaQuery.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => true,
  )
}
