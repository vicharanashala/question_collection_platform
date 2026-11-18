import { describe, expect, it, vi } from 'vitest'
import { clearProfileDraft, getProfileDraft, PROFILE_DRAFT_KEY, saveProfileDraft } from '@/utils/profileDraft'

describe('utils/profileDraft', () => {
  it('round-trips a wizard draft through localStorage', () => {
    saveProfileDraft({ step: 2, name: 'Asha' })

    expect(getProfileDraft<{ step: number; name: string }>()).toEqual({ step: 2, name: 'Asha' })
  })

  it('returns null without a draft', () => {
    expect(getProfileDraft()).toBeNull()
  })

  it('returns null for a corrupt draft instead of crashing the wizard', () => {
    localStorage.setItem(PROFILE_DRAFT_KEY, '{not json')

    expect(getProfileDraft()).toBeNull()
  })

  it('clears the draft', () => {
    saveProfileDraft({ step: 1 })

    clearProfileDraft()

    expect(localStorage.getItem(PROFILE_DRAFT_KEY)).toBeNull()
  })

  it('swallows storage errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(() => saveProfileDraft({})).not.toThrow()
    expect(() => clearProfileDraft()).not.toThrow()
  })
})
