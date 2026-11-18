import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from '@/hooks/ui/useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('paddy', 300))

    expect(result.current).toBe('paddy')
  })

  it('updates only after the delay of silence', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), { initialProps: { value: 'p' } })

    rerender({ value: 'pa' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: 'pad' })
    act(() => vi.advanceTimersByTime(200))
    expect(result.current).toBe('p')

    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('pad')
  })

  it('defaults to 400 ms', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value), { initialProps: { value: 'a' } })

    rerender({ value: 'b' })
    act(() => vi.advanceTimersByTime(399))
    expect(result.current).toBe('a')

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('b')
  })
})
