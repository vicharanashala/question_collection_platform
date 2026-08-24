import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Mic, MicOff, Square, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { speechApi, toSarvamLang } from '@/api/speech'
import { storageApi } from '@/api/storage'
import { cn } from '@/lib/utils'

type MicState = 'idle' | 'recording' | 'uploading' | 'done' | 'error'

interface MicButtonProps {
  /**
   * Called with the transcribed text when recording completes and
   * transcription succeeds. The host is responsible for merging the text
   * into its question textarea (typically with a leading space if the
   * textarea already has content).
   */
  onTranscribed: (text: string) => void
  /** Called when a new recording starts — use to clear any prior state. */
  onRecordingStart?: () => void
  /** Disable the button (e.g. when textbox is empty or daily limit reached). */
  disabled?: boolean
  /**
   * Language code for the STT call. Defaults to 'unknown' so Sarvam
   * auto-detects the spoken language. Pass an IETF code (e.g. 'hi-IN')
   * for stronger accuracy on a known language.
   */
  languageCode?: string
  /**
   * Max recording duration in milliseconds. When reached, the recorder
   * auto-stops, mirroring the mobile 55-second cap. Set to 0 to disable.
   */
  maxDurationMs?: number
}

/**
 * One-shot STT microphone button for the Public Ask Question page.
 *
 * Behaviour mirrors the mobile `SttMicButton`:
 *   idle → tap → recording → tap (or auto-stop at maxDuration) → uploading → done/error
 *
 * Implementation:
 *   - Uses the browser `MediaRecorder` API (no third-party libs)
 *   - Captures audio as a webm blob (Chromium, Firefox) or mp4 blob (Safari)
 *   - On stop, two-step STT flow (matches the mobile `SttMicButton` archival):
 *       1. Upload the blob to GCS via `storageApi.uploadAudio`
 *          → `POST /storage/upload/audio` → returns `{ url, sizeBytes }`
 *          → server persists the audio via `GcpStorageService` (Firebase
 *            Storage emulator in dev, real GCS in prod)
 *       2. Transcribe the same blob via `speechApi.speechToText`
 *          → `POST /speech/stt` → returns `{ text }`
 *   - On success, emits the transcribed text via `onTranscribed` and pops a
 *     success toast; on failure, pops an error toast
 *   - If the GCS upload fails the transcription still proceeds — the
 *     archive is best-effort, the transcript is what the user actually
 *     needs to continue with their question.
 *
 * Browser support:
 *   - Modern Chromium / Edge / Firefox / Safari 14.1+
 *   - Falls back to a disabled state with a tooltip if MediaRecorder is missing
 */
export function MicButton({
  onTranscribed,
  onRecordingStart,
  disabled,
  languageCode = 'unknown',
  maxDurationMs = 55_000,
}: MicButtonProps) {
  const [state, setState] = useState<MicState>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [supported] = useState(() =>
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== 'undefined',
  )

  // Refs (stable across renders)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)
  // Keep callback refs up to date without re-creating listeners.
  const onTranscribedRef = useRef(onTranscribed)
  const onRecordingStartRef = useRef(onRecordingStart)

  // Keep the refs current — done in an effect, not during render (lint rule).
  useEffect(() => {
    onTranscribedRef.current = onTranscribed
    onRecordingStartRef.current = onRecordingStart
  }, [onTranscribed, onRecordingStart])

  const isRecording = state === 'recording'
  const isUploading = state === 'uploading'
  const isFinal = state === 'done' || state === 'error'
  const isDisabled = disabled || isUploading || !supported

  // ─── Cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current)
      if (tickerRef.current) clearInterval(tickerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function fmtElapsed(ms: number) {
    const s = Math.floor(ms / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  // Stop the underlying MediaStream tracks and clear refs. Stable identity
  // (useCallback) so the start/stop handlers can call it without retriggering
  // effect dependencies.
  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return

    if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current)
    if (tickerRef.current) clearInterval(tickerRef.current)

    recorder.onstop = async () => {
      cleanupStream()
      setState('uploading')

      const mimeType = recorder.mimeType || 'audio/webm'
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const ext = mimeType.includes('mp4') || mimeType.includes('aac')
        ? 'm4a'
        : mimeType.includes('ogg')
          ? 'ogg'
          : 'webm'
      const filename = `recording-${Date.now()}.${ext}`

      if (blob.size === 0) {
        setState('error')
        toast.error('No audio captured. Please try again.')
        return
      }

      try {
        const sarvamCode = languageCode === 'unknown' ? 'unknown' : toSarvamLang(languageCode)

        // Step 1 — Archive the recording to GCS via /storage/upload/audio.
        // This mirrors the mobile `storageApi.uploadAudio()` call so the
        // backend `GcpStorageService` is invoked and the audio is persisted
        // (Firebase Storage emulator in dev, real GCS in prod). Best-effort:
        // a failure here is logged but does NOT block transcription — the
        // user has already recorded the audio and still needs the transcript.
        try {
          const uploaded = await storageApi.uploadAudio(blob, filename)
          // eslint-disable-next-line no-console
          console.info('[MicButton] audio archived to GCS:', uploaded.url)
        } catch (uploadErr) {
          console.warn(
            '[MicButton] audio archival failed (continuing with transcription):',
            uploadErr,
          )
        }

        // Step 2 — Transcribe via /speech/stt.
        const result = await speechApi.speechToText(blob, sarvamCode, filename)
        const text = (result.text ?? '').trim()
        if (!text) {
          setState('error')
          toast.error('We could not hear any words. Try again in a quieter place.')
          return
        }
        setState('done')
        onTranscribedRef.current?.(text)
        toast.success('Voice captured. Review and continue.', {
          description: text.length > 80 ? text.slice(0, 80) + '…' : text,
        })
      } catch (err) {
        console.error('[MicButton] speechToText error:', err)
        const msg = err instanceof Error ? err.message : 'Transcription failed.'
        setState('error')
        toast.error(msg)
      }
    }

    try {
      recorder.stop()
    } catch (err) {
      console.error('[MicButton] stop() error:', err)
      cleanupStream()
      setState('error')
      toast.error('Could not stop recording.')
    }
  }, [cleanupStream, languageCode])

  const startRecording = useCallback(async () => {
    if (!supported) {
      toast.error('Microphone recording is not supported in this browser.')
      return
    }
    try {
      onRecordingStartRef.current?.()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Phone-call-grade audio is fine for STT; this halves the blob size.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      // Pick the first supported MIME type. Safari iOS sometimes only has 'audio/mp4'.
      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        '',
      ]
      let mimeType = ''
      for (const t of preferredTypes) {
        if (
          t === '' ||
          (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t))
        ) {
          mimeType = t
          break
        }
      }
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onerror = (event) => {
        console.error('[MicButton] recorder error:', event)
        setState('error')
        toast.error('Recording failed. Please try again.')
        cleanupStream()
      }

      mediaRecorderRef.current = recorder
      recorder.start(250) // 250 ms chunks → bounded blob size even on abrupt stop
      startTimeRef.current = Date.now()
      setElapsedMs(0)
      setState('recording')

      // 4 Hz ticker for the duration badge
      tickerRef.current = setInterval(() => {
        if (startTimeRef.current != null) {
          setElapsedMs(Date.now() - startTimeRef.current)
        }
      }, 250)

      // Auto-stop at maxDuration
      if (maxDurationMs > 0) {
        autoStopTimeoutRef.current = setTimeout(() => {
          stopRecording()
        }, maxDurationMs)
      }
    } catch (err) {
      console.error('[MicButton] startRecording error:', err)
      const msg =
        err instanceof Error && /denied|permission/i.test(err.message)
          ? 'Microphone permission denied. Allow microphone access and retry.'
          : 'Could not start recording. Please try again.'
      toast.error(msg)
      cleanupStream()
      setState('error')
    }
  }, [cleanupStream, stopRecording, supported, maxDurationMs])

  function handleClick() {
    if (isDisabled) return
    if (state === 'idle' || isFinal) {
      void startRecording()
    } else if (isRecording) {
      stopRecording()
    }
  }

  // Reset back to idle a few seconds after `done`/`error` so the user can
  // re-record cleanly without having to wait for any debounce.
  useEffect(() => {
    if (state === 'done' || state === 'error') {
      const timer = setTimeout(() => setState('idle'), 4_000)
      return () => clearTimeout(timer)
    }
  }, [state])

  // Visual variants
  const bg = isDisabled
    ? 'bg-surface-variant text-text-tertiary'
    : isUploading
      ? 'bg-primary/80'
      : isFinal
        ? 'bg-success'
        : isRecording
          ? 'bg-destructive'
          : 'bg-primary'

  const label = !supported
    ? 'Mic not supported on this browser'
    : isUploading
      ? 'Transcribing…'
      : isFinal
        ? 'Done — speak again any time'
        : isRecording
          ? 'Tap to stop recording'
          : 'Tap the mic to speak your question'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        {/* Pulse ring (visible while recording) */}
        {isRecording && (
          <span
            aria-hidden
            className="absolute inline-flex h-[110px] w-[110px] animate-ping rounded-full bg-destructive/25"
          />
        )}

        <Button
          type="button"
          onClick={handleClick}
          disabled={isDisabled}
          aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
          aria-pressed={isRecording}
          className={cn(
            'relative h-[88px] w-[88px] rounded-full shadow-lg ring-offset-background transition-all duration-200',
            'hover:scale-105 active:scale-95',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/40',
            bg,
          )}
        >
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          ) : isFinal ? (
            <CheckCircle2 className="h-9 w-9 text-white" />
          ) : isRecording ? (
            <Square className="h-8 w-8 text-white" />
          ) : !supported ? (
            <MicOff className="h-9 w-9" />
          ) : (
            <Mic className="h-9 w-9 text-white" />
          )}

          {/* Recording duration badge */}
          {isRecording && (
            <span className="absolute -bottom-2 -right-2 rounded-md bg-destructive px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-md">
              {fmtElapsed(elapsedMs)}
            </span>
          )}
        </Button>
      </div>

      <p
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] sm:text-[11px] sm:text-xs font-medium',
          isRecording
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : isUploading
              ? 'border-primary/40 bg-primary/10 text-primary'
              : isFinal
                ? 'border-success/40 bg-success/10 text-success'
                : !supported
                  ? 'border-border-subtle bg-surface-variant text-text-tertiary'
                  : 'border-primary/30 bg-primary/10 text-primary',
        )}
      >
        <Mic className="h-3.5 w-3.5" aria-hidden />
        <span>{label}</span>
      </p>
    </div>
  )
}