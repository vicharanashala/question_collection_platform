import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'anveshan_mode'
const listeners = new Set<() => void>()

// Reads the saved mode; it is off by default and when storage is unavailable.
function readMode(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

let current = readMode()

/** Whether staff Anveshan mode is on (only Anveshan user data is shown). */
export function isAnveshanMode(): boolean {
  return current
}

/** Turns Anveshan mode on or off and notifies subscribed components. */
export function setAnveshanMode(on: boolean): void {
  current = on
  try {
    if (on) sessionStorage.setItem(STORAGE_KEY, 'on')
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage is optional; the mode still works for this page load.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** React hook returning the current Anveshan mode. */
export function useAnveshanMode(): boolean {
  return useSyncExternalStore(subscribe, isAnveshanMode, isAnveshanMode)
}
