import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useQuestionDraft } from '@/hooks/ui/useQuestionDraft'
import { clearQuestionDraft, QUESTION_DRAFT_KEY, saveQuestionDraft } from '@/utils/questionDraft'

describe('useQuestionDraft', () => {
  it('reflects an existing draft on mount', () => {
    saveQuestionDraft('draft')

    expect(renderHook(() => useQuestionDraft()).result.current.hasDraft).toBe(true)
  })

  it('updates when the draft changes in this tab', () => {
    const { result } = renderHook(() => useQuestionDraft())
    expect(result.current.hasDraft).toBe(false)

    act(() => saveQuestionDraft('new draft'))
    expect(result.current.hasDraft).toBe(true)

    act(() => clearQuestionDraft())
    expect(result.current.hasDraft).toBe(false)
  })

  it('updates when another tab changes storage', () => {
    const { result } = renderHook(() => useQuestionDraft())

    act(() => {
      localStorage.setItem(QUESTION_DRAFT_KEY, 'from another tab')
      window.dispatchEvent(new StorageEvent('storage', { key: QUESTION_DRAFT_KEY }))
    })

    expect(result.current.hasDraft).toBe(true)
  })
})
