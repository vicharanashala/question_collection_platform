import { createModeStore } from './modeStore'

const store = createModeStore('tester_scope')

/** Staff Tester mode: all accounts, only tester accounts, or everyone except testers. */
export const getTesterScope = store.get

/** Changes the Tester mode and notifies subscribed components. */
export const setTesterScope = store.set

/** React hook returning the current Tester mode. */
export const useTesterScope = store.useScope
