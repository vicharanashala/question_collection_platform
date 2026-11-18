import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isNewFeature, markFeatureSeen, NEW_FEATURES, useIsNewFeature, type NewFeatureKey } from '@/lib/newFeatures'

// Uses whichever feature is listed first, so the test keeps working as entries are added and removed.
const KEY = Object.keys(NEW_FEATURES)[0] as NewFeatureKey | undefined
const expiry = KEY ? new Date(`${NEW_FEATURES[KEY].expiresOn}T23:59:59`) : new Date()

describe.skipIf(!KEY)('lib/newFeatures', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const at = (date: Date) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(date)
  }

  it('shows the badge until the end of the expiry day', () => {
    at(new Date(expiry.getTime() - 1000))

    expect(isNewFeature(KEY!)).toBe(true)
  })

  it('hides the badge after it expires', () => {
    at(new Date(expiry.getTime() + 1000))

    expect(isNewFeature(KEY!)).toBe(false)
  })

  it('hides the badge once the user has seen the feature', () => {
    at(new Date(expiry.getTime() - 86_400_000))

    markFeatureSeen(KEY!)

    expect(isNewFeature(KEY!)).toBe(false)
  })

  it('updates subscribed components when the feature is marked seen', () => {
    at(new Date(expiry.getTime() - 86_400_000))
    const { result } = renderHook(() => useIsNewFeature(KEY!))
    expect(result.current).toBe(true)

    act(() => markFeatureSeen(KEY!))

    expect(result.current).toBe(false)
  })

  it('treats blocked storage as not seen', () => {
    at(new Date(expiry.getTime() - 86_400_000))
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(isNewFeature(KEY!)).toBe(true)
  })
})
