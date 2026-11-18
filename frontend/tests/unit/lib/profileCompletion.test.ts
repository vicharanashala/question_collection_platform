import { describe, expect, it } from 'vitest'
import { isProfileIncomplete } from '@/lib/profileCompletion'
import { buildAuthUser } from '../../utils/factories'

describe('isProfileIncomplete', () => {
  it('is false for a user who finished the wizard', () => {
    expect(isProfileIncomplete(buildAuthUser())).toBe(false)
  })

  it('is true when the user is not known yet', () => {
    expect(isProfileIncomplete(null)).toBe(true)
    expect(isProfileIncomplete(undefined)).toBe(true)
  })

  it.each([
    ['consent missing', { consentGiven: false }],
    ['name empty', { name: '' }],
    ['name only whitespace', { name: '   ' }],
    ['category missing', { category: null }],
    ['username missing', { username: null }],
    ['username only whitespace', { username: '  ' }],
  ])('is true when %s', (_case, overrides) => {
    expect(isProfileIncomplete(buildAuthUser(overrides))).toBe(true)
  })
})
