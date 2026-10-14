import { createModeStore } from './modeStore'

const store = createModeStore('anveshan_mode')

/** Whether staff Anveshan mode is on (only Anveshan user data is shown). */
export const isAnveshanMode = store.get

/** Turns Anveshan mode on or off and notifies subscribed components. */
export const setAnveshanMode = store.set

/** React hook returning the current Anveshan mode. */
export const useAnveshanMode = store.useMode
