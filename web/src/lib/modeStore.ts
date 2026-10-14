import { useSyncExternalStore } from 'react'

export type ModeScope = 'all' | 'only' | 'exclude'

export interface ModeStore {
  get: () => ModeScope
  set: (scope: ModeScope) => void
  useScope: () => ModeScope
}

// Creates a staff scope (all, only, exclude) that starts as all and resets on every page reload.
export function createModeStore(): ModeStore {
  const listeners = new Set<() => void>()
  let current: ModeScope = 'all'
  const get = () => current

  const set = (scope: ModeScope) => {
    current = scope
    listeners.forEach((listener) => listener())
  }

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { get, set, useScope: () => useSyncExternalStore(subscribe, get, get) }
}
