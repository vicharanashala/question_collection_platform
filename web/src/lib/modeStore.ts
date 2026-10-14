import { useSyncExternalStore } from 'react'

export interface ModeStore {
  get: () => boolean
  set: (on: boolean) => void
  useMode: () => boolean
}

// Creates an on/off staff mode that is off by default and remembered for the browser tab.
export function createModeStore(storageKey: string): ModeStore {
  const listeners = new Set<() => void>()

  const read = (): boolean => {
    try {
      return sessionStorage.getItem(storageKey) === 'on'
    } catch {
      return false
    }
  }

  let current = read()
  const get = () => current

  const set = (on: boolean) => {
    current = on
    try {
      if (on) sessionStorage.setItem(storageKey, 'on')
      else sessionStorage.removeItem(storageKey)
    } catch {
      // Storage is optional; the mode still works for this page load.
    }
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { get, set, useMode: () => useSyncExternalStore(subscribe, get, get) }
}
