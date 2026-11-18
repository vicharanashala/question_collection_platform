import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from '@/hooks/ui/useMediaQuery'

// Installs a controllable matchMedia and returns a function that flips the match state.
function mockMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return matches
        },
        media: query,
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
      }) as unknown as MediaQueryList,
  )
  return {
    listeners,
    set(next: boolean) {
      matches = next
      listeners.forEach((cb) => cb())
    },
  }
}

describe('useMediaQuery', () => {
  it('returns the current match and follows viewport changes', () => {
    const media = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 640px)'))
    expect(result.current).toBe(false)

    act(() => media.set(true))

    expect(result.current).toBe(true)
  })

  it('unsubscribes on unmount', () => {
    const media = mockMatchMedia(true)
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 640px)'))

    unmount()

    expect(media.listeners.size).toBe(0)
  })
})
