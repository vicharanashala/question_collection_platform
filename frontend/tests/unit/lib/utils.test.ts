import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  calcChange,
  calcDelta,
  cn,
  formatDate,
  formatDuration,
  formatINR,
  formatINRCompact,
  formatINRFull,
  formatRelativeDate,
  formatTime,
  getBalanceTextClass,
  getInitials,
} from '@/lib/utils'

describe('lib/utils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('cn', () => {
    it('merges conflicting Tailwind classes, last one wins', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })

    it('drops falsy values', () => {
      const isActive = Boolean(0)

      expect(cn('a', isActive && 'b', undefined, null, 'c')).toBe('a c')
    })
  })

  describe('date formatting', () => {
    it.each([null, undefined, ''])('returns null for %p', (value) => {
      expect(formatDate(value)).toBeNull()
      expect(formatTime(value)).toBeNull()
    })

    it('formats dates in Indian English', () => {
      expect(formatDate('2026-03-05T10:00:00Z')).toBe('05 Mar 2026')
    })

    it('returns null for invalid times instead of "Invalid Date"', () => {
      expect(formatTime('not-a-date')).toBeNull()
    })
  })

  describe('formatRelativeDate', () => {
    it.each([
      [0, 'Today'],
      [-3, 'Today'],
      [1, 'Tomorrow'],
      [3, 'In 3 days'],
      [10, 'In 2 weeks'],
      [45, 'In 2 months'],
    ])('describes %i days from now as %p', (days, expected) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
      const date = new Date(Date.now() + days * 86_400_000).toISOString()

      expect(formatRelativeDate(date)).toBe(expected)
    })
  })

  describe('getInitials', () => {
    it.each([
      ['Ramesh Kumar', '', 'RK'],
      ['Ramesh Kumar Singh', '', 'RS'],
      ['Asha', '', 'AS'],
      ['', '9876543210', '98'],
      ['', '', '?'],
    ])('getInitials(%p, %p) is %p', (name, mobile, expected) => {
      expect(getInitials(name, mobile)).toBe(expected)
    })
  })

  describe('percent change', () => {
    it('returns 0 when there is no previous value instead of dividing by zero', () => {
      expect(calcDelta(50, 0)).toBe(0)
    })

    it('rounds the percentage change', () => {
      expect(calcDelta(150, 100)).toBe(50)
      expect(calcDelta(2, 3)).toBe(-33)
    })

    it('labels increases with a plus sign', () => {
      expect(calcChange(120, 100)).toEqual({ value: 20, label: '+20%' })
      expect(calcChange(80, 100)).toEqual({ value: -20, label: '-20%' })
    })
  })

  describe('formatDuration', () => {
    it.each([
      [0, '0m'],
      [-5, '0m'],
      [45, '45m'],
      [60, '1h'],
      [90, '1h 30m'],
      [1440, '1d'],
      [1501, '1d 1h 1m'],
    ])('formats %i minutes as %p', (minutes, expected) => {
      expect(formatDuration(minutes)).toBe(expected)
    })
  })

  describe('currency', () => {
    it.each([
      [999, '999'],
      [1500, '1.5k'],
      [150_000, '1.5L'],
      [25_000_000, '2.5Cr'],
    ])('formatINR(%i) is %p', (amount, expected) => {
      expect(formatINR(amount)).toBe(expected)
    })

    it.each([
      [999, '999'],
      [1000, '1K'],
      [10_500, '10.5K'],
      [100_000, '1L'],
      [1_500_000, '15L'],
      [10_000_000, '1Cr'],
    ])('formatINRCompact(%i) is %p', (amount, expected) => {
      expect(formatINRCompact(amount)).toBe(expected)
    })

    it('always shows two decimals with Indian grouping', () => {
      expect(formatINRFull(150630)).toBe('1,50,630.00')
    })

    it.each([
      [5, 'text-4xl'],
      [999, 'text-3xl'],
      [9_999, 'text-2xl'],
      [99_999, 'text-xl'],
    ])('sizes a balance of %i as %p', (amount, expected) => {
      expect(getBalanceTextClass(amount)).toBe(expected)
    })
  })
})
