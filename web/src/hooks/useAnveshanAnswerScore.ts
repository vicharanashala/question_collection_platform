import { useCallback, useEffect, useRef, useState } from 'react'
import { questionApi } from '@/api/client'
import type { AnveshanAnswerScore } from '@/types'

const POLL_INTERVAL_MS = 3000
// About two minutes of polling before asking the user to check again.
const MAX_POLL_ATTEMPTS = 40

// Polls the advisory score while the scoring job is processing and reports each update.
export function useAnveshanAnswerScore(
  questionId: string,
  initialScore: AnveshanAnswerScore | null,
  onScoreChange?: (score: AnveshanAnswerScore) => void,
) {
  const [score, setScore] = useState<AnveshanAnswerScore | null>(initialScore)
  const [isPolling, setIsPolling] = useState(initialScore?.status === 'processing')
  const [timedOut, setTimedOut] = useState(false)
  const onScoreChangeRef = useRef(onScoreChange)

  // Keeps the latest callback without restarting the polling loop when the parent re-renders.
  useEffect(() => {
    onScoreChangeRef.current = onScoreChange
  }, [onScoreChange])

  useEffect(() => {
    if (!isPolling) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0

    const poll = async () => {
      attempts += 1
      try {
        const next = await questionApi.getAnveshanAnswerScore(questionId)
        if (cancelled) return
        setScore(next)
        onScoreChangeRef.current?.(next)
        if (next.status !== 'processing') {
          setIsPolling(false)
          return
        }
      } catch {
        // Network errors are retried on the next tick until the attempt limit.
        if (cancelled) return
      }
      if (attempts >= MAX_POLL_ATTEMPTS) {
        setIsPolling(false)
        setTimedOut(true)
        return
      }
      timer = setTimeout(() => void poll(), POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isPolling, questionId])

  // Asks the server again; it restarts scoring when the earlier job failed.
  const checkAgain = useCallback(() => {
    setTimedOut(false)
    setIsPolling(true)
  }, [])

  return { score, isPolling, timedOut, checkAgain }
}
