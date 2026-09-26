import { useEffect, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

interface CountUpOptions {
  /** Animation length in seconds. */
  duration?: number
  /** Seconds to wait before counting starts. */
  delay?: number
  /** Restarts the animation from zero whenever this becomes true. */
  active?: boolean
}

// Animates a number from zero to the target, jumping straight to it when reduced motion is preferred.
export function useCountUp(target: number, { duration = 0.9, delay = 0, active = true }: CountUpOptions = {}): number {
  const reduceMotion = useReducedMotion()
  const [value, setValue] = useState(reduceMotion ? target : 0)

  useEffect(() => {
    if (!active) return
    if (reduceMotion) {
      setValue(target)
      return
    }
    setValue(0)
    const controls = animate(0, target, {
      duration,
      delay,
      ease: 'easeOut',
      onUpdate: (latest) => setValue(Math.round(latest)),
    })
    return () => controls.stop()
  }, [target, duration, delay, active, reduceMotion])

  return value
}
