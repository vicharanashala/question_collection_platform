const laterKey = (userId: string) => `anveshan_feedback_later_${userId}`

// True when the user chose "Maybe later" earlier in this browser session. Storage may be unavailable, which counts as no.
export function isFeedbackDeferred(userId: string): boolean {
  try {
    return sessionStorage.getItem(laterKey(userId)) === '1'
  } catch {
    return false
  }
}

// Remembers "Maybe later" until the browser session ends, so the prompt returns on a later visit.
export function deferFeedback(userId: string): void {
  try {
    sessionStorage.setItem(laterKey(userId), '1')
  } catch {
    // Non-critical: the prompt may show again on the next page load.
  }
}
