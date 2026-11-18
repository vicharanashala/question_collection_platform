import { describe, expect, it, vi } from 'vitest'
import {
  clearQuestionDraft,
  getQuestionDraft,
  hasQuestionDraft,
  markQuestionDraftAsSeen,
  QUESTION_DRAFT_EVENT,
  QUESTION_DRAFT_KEY,
  QUESTION_DRAFT_SEEN_KEY,
  saveQuestionDraft,
} from '@/utils/questionDraft'

describe('utils/questionDraft', () => {
  it('saves a trimmed draft, marks it unseen and notifies listeners', () => {
    const listener = vi.fn()
    window.addEventListener(QUESTION_DRAFT_EVENT, listener)

    saveQuestionDraft('  How to control aphids?  ')

    expect(getQuestionDraft()).toBe('How to control aphids?')
    expect(localStorage.getItem(QUESTION_DRAFT_SEEN_KEY)).toBe('false')
    expect(hasQuestionDraft()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(QUESTION_DRAFT_EVENT, listener)
  })

  it('clears the draft when saving only whitespace', () => {
    saveQuestionDraft('draft')

    saveQuestionDraft('   ')

    expect(localStorage.getItem(QUESTION_DRAFT_KEY)).toBeNull()
    expect(localStorage.getItem(QUESTION_DRAFT_SEEN_KEY)).toBeNull()
    expect(hasQuestionDraft()).toBe(false)
  })

  it('marks an existing draft as seen', () => {
    saveQuestionDraft('draft')

    markQuestionDraftAsSeen()

    expect(localStorage.getItem(QUESTION_DRAFT_SEEN_KEY)).toBe('true')
  })

  it('does not mark anything seen without a draft', () => {
    markQuestionDraftAsSeen()

    expect(localStorage.getItem(QUESTION_DRAFT_SEEN_KEY)).toBeNull()
  })

  it('clears the draft and its seen flag', () => {
    saveQuestionDraft('draft')

    clearQuestionDraft()

    expect(getQuestionDraft()).toBe('')
    expect(localStorage.getItem(QUESTION_DRAFT_SEEN_KEY)).toBeNull()
  })

  it('degrades to an empty draft when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(getQuestionDraft()).toBe('')
    expect(hasQuestionDraft()).toBe(false)
  })

  it('does not throw when storage is full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => saveQuestionDraft('draft')).not.toThrow()
  })
})
