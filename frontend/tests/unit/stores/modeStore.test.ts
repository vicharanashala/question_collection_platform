import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createModeStore } from '@/stores/modeStore'
import { getAnveshanScope, setAnveshanScope } from '@/stores/anveshanMode'
import { getTesterScope, setTesterScope } from '@/stores/testerMode'

describe('stores/modeStore', () => {
  it('starts as "all"', () => {
    expect(createModeStore().get()).toBe('all')
  })

  it('updates subscribed components', () => {
    const store = createModeStore()
    const { result } = renderHook(() => store.useScope())

    act(() => store.set('only'))

    expect(result.current).toBe('only')
    expect(store.get()).toBe('only')
  })

  it('keeps separate stores independent', () => {
    const a = createModeStore()
    const b = createModeStore()

    a.set('exclude')

    expect(b.get()).toBe('all')
  })

  it('keeps the Anveshan and Tester modes independent', () => {
    setAnveshanScope('only')

    expect(getAnveshanScope()).toBe('only')
    expect(getTesterScope()).toBe('all')

    setAnveshanScope('all')
    setTesterScope('all')
  })
})
