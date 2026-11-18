import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRelativeTime } from '@/components/submissions/useRelativeTime'

const NOW = new Date('2026-06-15T12:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
const HOUR = 3_600_000

describe('useRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const format = () => renderHook(() => useRelativeTime()).result.current

  it('says "just now" within the first hour', () => {
    expect(format()(ago(59 * 60_000))).toBe('just now')
  })

  it('counts hours within a day', () => {
    expect(format()(ago(3 * HOUR))).toBe('3h ago')
  })

  it('counts days within a week', () => {
    expect(format()(ago(2 * 24 * HOUR))).toMatch(/^2/)
  })

  it('shows a short date after a week', () => {
    const value = format()(ago(10 * 24 * HOUR))

    expect(value).toMatch(/Jun|6/)
    expect(value).not.toMatch(/ago/)
  })
})
