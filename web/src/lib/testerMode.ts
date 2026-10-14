import { createModeStore } from './modeStore'

const store = createModeStore('tester_mode')

/** Whether staff Tester mode is on (only tester account data is shown instead of real user data). */
export const isTesterMode = store.get

/** Turns Tester mode on or off and notifies subscribed components. */
export const setTesterMode = store.set

/** React hook returning the current Tester mode. */
export const useTesterMode = store.useMode
