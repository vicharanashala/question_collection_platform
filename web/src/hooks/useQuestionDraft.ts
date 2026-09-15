import { useEffect, useState } from 'react'

import {
  QUESTION_DRAFT_EVENT,
  hasQuestionDraft,
} from '@/utils/questionDraft'

export function useQuestionDraft() {
  const [hasDraft, setHasDraft] = useState(hasQuestionDraft)

  useEffect(() => {
    const updateDraftStatus = () => {
      setHasDraft(hasQuestionDraft())
    }

    window.addEventListener(QUESTION_DRAFT_EVENT, updateDraftStatus)
    window.addEventListener('storage', updateDraftStatus)

    return () => {
      window.removeEventListener(QUESTION_DRAFT_EVENT, updateDraftStatus)
      window.removeEventListener('storage', updateDraftStatus)
    }
  }, [])

  return {
    hasDraft,
  }
}