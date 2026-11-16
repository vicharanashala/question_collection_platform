import { useEffect, useState } from 'react'

// Matches phones and tablets: the primary input is touch and it cannot hover.
const QUERY = '(hover: none) and (pointer: coarse)'

export function useIsTouchDevice(): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )
  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return matches
}