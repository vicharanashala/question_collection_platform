import { useSyncExternalStore } from 'react'

export type ModeScope = 'all' | 'only' | 'exclude'

export interface ModeStore {
  get: () => ModeScope
  set: (scope: ModeScope) => void
  useScope: () => ModeScope
}

// Creates a staff scope (all, only, exclude) that defaults to all and is remembered for the browser tab.
export function createModeStore(storageKey: string): ModeStore {
  const listeners = new Set<() => void>()

  const read = (): ModeScope => {
    try {
      const saved = sessionStorage.getItem(storageKey)
      return saved === 'only' || saved === 'exclude' ? saved : 'all'
    } catch {
      return 'all'
    }
  }

  let current = read()
  const get = () => current

  const set = (scope: ModeScope) => {
    current = scope
    try {
      if (scope === 'all') sessionStorage.removeItem(storageKey)
      else sessionStorage.setItem(storageKey, scope)
    } catch {
      // Storage is optional; the scope still works for this page load.
    }
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { get, set, useScope: () => useSyncExternalStore(subscribe, get, get) }
}
