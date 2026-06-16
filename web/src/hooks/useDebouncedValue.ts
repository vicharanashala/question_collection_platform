import { useState, useEffect } from 'react'

/**
 * Returns a debounced version of the given value.
 * The returned value only updates after `delay` ms of silence.
 */
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}