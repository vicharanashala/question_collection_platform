export const QUESTION_DRAFT_KEY = 'public-ask-question-draft'
export const QUESTION_DRAFT_SEEN_KEY = 'public-ask-question-draft-seen'
export const QUESTION_DRAFT_EVENT = 'public-ask-question-draft-changed'

function notifyDraftChange() {
  window.dispatchEvent(new Event(QUESTION_DRAFT_EVENT))
}

export function getQuestionDraft(): string {
  if (typeof window === 'undefined') return ''

  try {
    return window.localStorage.getItem(QUESTION_DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveQuestionDraft(value: string): void {
  if (typeof window === 'undefined') return

  try {
    const draft = value.trim()

    if (!draft) {
      clearQuestionDraft()
      return
    }

    window.localStorage.setItem(QUESTION_DRAFT_KEY, draft)

    // Every save means the draft is currently being worked on.
    window.localStorage.setItem(QUESTION_DRAFT_SEEN_KEY, 'false')

    notifyDraftChange()
  } catch {
    // Ignore localStorage errors.
  }
}

export function clearQuestionDraft(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(QUESTION_DRAFT_KEY)
    window.localStorage.removeItem(QUESTION_DRAFT_SEEN_KEY)

    notifyDraftChange()
  } catch {
    // Ignore localStorage errors.
  }
}

export function markQuestionDraftAsSeen(): void {
  if (typeof window === 'undefined') return

  try {
    if (getQuestionDraft().trim()) {
      window.localStorage.setItem(QUESTION_DRAFT_SEEN_KEY, 'true')
    }

    notifyDraftChange()
  } catch {
    // Ignore localStorage errors.
  }
}

export function hasQuestionDraft(): boolean {
  return Boolean(getQuestionDraft().trim())
}