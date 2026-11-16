export const PROFILE_DRAFT_KEY = 'complete-profile-wizard-draft'

export function getProfileDraft<T>(): T | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_DRAFT_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveProfileDraft(value: unknown): void {
  try {
    window.localStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify(value))
  } catch {
    // Ignore localStorage errors.
  }
}

export function clearProfileDraft(): void {
  try {
    window.localStorage.removeItem(PROFILE_DRAFT_KEY)
  } catch {
    // Ignore localStorage errors.
  }
}
