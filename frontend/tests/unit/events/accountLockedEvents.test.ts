import { afterEach, describe, expect, it, vi } from 'vitest'
import { accountLockedEmitter, endSession, parseAccountLocked, sessionExpiredEmitter } from '@/events/accountLockedEvents'
import { anveshanProgressEmitter } from '@/events/anveshanProgressEvents'

describe('events/accountLockedEvents', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('parseAccountLocked', () => {
    it('parses a suspended response from the API', () => {
      expect(
        parseAccountLocked({
          status: 'suspended',
          reason: 'Spam',
          suspendedAt: '2026-11-01T00:00:00Z',
          suspendedUntil: '2026-11-08T00:00:00Z',
          bannedAt: null,
        }),
      ).toEqual({
        status: 'suspended',
        reason: 'Spam',
        suspendedAt: '2026-11-01T00:00:00Z',
        suspendedUntil: '2026-11-08T00:00:00Z',
        bannedAt: null,
      })
    })

    it('normalises non-string fields to null', () => {
      expect(parseAccountLocked({ status: 'banned', reason: 42, bannedAt: {} })).toEqual({
        status: 'banned',
        reason: null,
        suspendedAt: null,
        suspendedUntil: null,
        bannedAt: null,
      })
    })

    it.each([null, undefined, 'locked', 42, {}, { status: 'verified' }, { status: 'SUSPENDED' }])('ignores %p', (body) => {
      expect(parseAccountLocked(body)).toBeNull()
    })
  })

  it('delivers lock events until the listener unsubscribes', () => {
    const listener = vi.fn()
    const unsubscribe = accountLockedEmitter.on(listener)
    const info = { status: 'banned' as const, reason: null, suspendedAt: null, bannedAt: null, suspendedUntil: null }

    accountLockedEmitter.emit(info)
    unsubscribe()
    accountLockedEmitter.emit(info)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(info)
  })

  it('ends the session only once when parallel requests all fail with 401', () => {
    vi.useFakeTimers()
    const listener = vi.fn()
    const unsubscribe = sessionExpiredEmitter.on(listener)

    endSession()
    endSession()
    endSession()
    expect(listener).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    endSession()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    vi.advanceTimersByTime(1000)
  })

  it('notifies Anveshan progress listeners', () => {
    const listener = vi.fn()
    const unsubscribe = anveshanProgressEmitter.on(listener)

    anveshanProgressEmitter.emit()
    unsubscribe()
    anveshanProgressEmitter.emit()

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
