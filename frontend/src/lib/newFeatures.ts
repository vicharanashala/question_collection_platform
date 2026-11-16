import { useSyncExternalStore } from 'react'

/**
 * Features that show a "New" badge. Add an entry to badge a new feature and
 * remove it (or let it expire) once the feature is no longer new.
 * A badge also hides after the user has seen the feature.
 */
export const NEW_FEATURES = {
  // FAQ page for users.
  faq: { expiresOn: '2026-11-20' },
  // FAQ management entry in the admin navigation.
  faqAdmin: { expiresOn: '2026-11-20' },
  // Drag to reorder and the audience filter on the admin FAQ page.
  faqAdminTools: { expiresOn: '2026-11-20' },
  // In-app camera with date, time, location and brand stamp on the photo.
  takePhoto: { expiresOn: '2026-11-20' },
  // Super Admin user filter on the Agri Entities and Questions pages.
  entityUserFilter: { expiresOn: '2026-11-20' },
  // Super Admin Excel export of Anveshan entities.
  entityExport: { expiresOn: '2026-11-20' },
  // Newest or oldest first toggle on the admin Agri Entities list.
  entitySortOrder: { expiresOn: '2026-11-20' },
  // Sortable column titles on the Users table, including Anveshan progress.
  userColumnSort: { expiresOn: '2026-11-20' },
  // Dedicated detail page for Anveshan users.
  anveshanUserPage: { expiresOn: '2026-11-20' },
  // Excel export on the Anveshan user detail page.
  anveshanUserExport: { expiresOn: '2026-11-20' },
} as const

export type NewFeatureKey = keyof typeof NEW_FEATURES

const STORAGE_PREFIX = 'new-feature-seen:'
const CHANGE_EVENT = 'new-feature-seen-change'

// Reads the seen flag, treating blocked storage as not seen.
function hasSeen(key: NewFeatureKey): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key) === '1'
  } catch {
    return false
  }
}

// True while the feature is inside its "new" window and the user has not seen it yet.
export function isNewFeature(key: NewFeatureKey): boolean {
  const endOfDay = new Date(`${NEW_FEATURES[key].expiresOn}T23:59:59`)
  return Date.now() <= endOfDay.getTime() && !hasSeen(key)
}

// Remembers that the user has seen the feature so its badge disappears everywhere.
export function markFeatureSeen(key: NewFeatureKey): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, '1')
  } catch {
    // Storage can be unavailable; the badge then simply stays until it expires.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// Subscribes a component to the badge state of one feature.
export function useIsNewFeature(key: NewFeatureKey): boolean {
  return useSyncExternalStore(subscribe, () => isNewFeature(key), () => false)
}
