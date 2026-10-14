import { createModeStore } from './modeStore'

const store = createModeStore('anveshan_scope')

/** Staff Anveshan mode: all users, only Anveshan users, or everyone except them. */
export const getAnveshanScope = store.get

/** Changes the Anveshan mode and notifies subscribed components. */
export const setAnveshanScope = store.set

/** React hook returning the current Anveshan mode. */
export const useAnveshanScope = store.useScope
