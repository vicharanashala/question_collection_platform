import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Mic, MicOff, Square, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { speechApi, toSarvamLang } from '@/api/speech'
import { storageApi } from '@/api/storage'
import { cn } from '@/lib/utils'

type MicState = 'idle' | 'recording' | 'uploading' | 'done' | 'error'

// Default recording cap. Long audio is transcribed in ~30 s chunks, so this
// keeps the whole transcription inside the client STT request timeout.
export const DEFAULT_MAX_RECORDING_MS = 180_000

// Recording auto-stops after this long without detected speech.
export const SILENCE_TIMEOUT_MS = 60_000

// RMS level (0 to 1) above which input counts as speech. Browser noise
// suppression keeps a quiet room well below this.
const SPEECH_RMS_THRESHOLD = 0.015

// Returns the RMS level of the analyser's current audio frame.
function readInputLevel(analyser: AnalyserNode, samples: Float32Array): number {
  analyser.getFloatTimeDomainData(samples)
  let sumOfSquares = 0
  for (const sample of samples) sumOfSquares += sample * sample
  return Math.sqrt(sumOfSquares / samples.length)
}

interface MicButtonProps {
  /**
   * Called with the transcribed text when recording completes and
   * transcription succeeds. The host is responsible for merging the text
   * into its question textarea (typically with a leading space if the
   * textarea already has content).
   */
  onTranscribed: (text: string, blob?: Blob, filename?: string) => void
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
   * auto-stops. The backend splits long audio into ~30 s chunks, so this is
   * kept at 3 minutes to stay within the client STT request timeout.
   * Set to 0 to disable.
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
  maxDurationMs = DEFAULT_MAX_RECORDING_MS,
}: MicButtonProps) {
  const { t } = useTranslation()
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
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const levelSamplesRef = useRef<Float32Array | null>(null)
  const lastSpeechAtRef = useRef<number>(0)
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
      void audioContextRef.current?.close().catch(() => undefined)
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
    void audioContextRef.current?.close().catch(() => undefined)
    audioContextRef.current = null
    analyserRef.current = null
    levelSamplesRef.current = null
  }, [])

  // Attaches a level analyser to the stream for silence detection. Failure is
  // non-fatal: recording continues and only the silence auto-stop is skipped.
  const startSilenceMonitor = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      audioContext.createMediaStreamSource(stream).connect(analyser)
      void audioContext.resume().catch(() => undefined)
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      levelSamplesRef.current = new Float32Array(analyser.fftSize)
    } catch (err) {
      console.warn('[MicButton] silence detection unavailable:', err)
    }
    lastSpeechAtRef.current = Date.now()
  }, [])

  // Returns true when no speech has been detected for SILENCE_TIMEOUT_MS.
  const hasBeenSilentTooLong = useCallback((now: number) => {
    const analyser = analyserRef.current
    const samples = levelSamplesRef.current
    if (!analyser || !samples) return false
    if (readInputLevel(analyser, samples) >= SPEECH_RMS_THRESHOLD) {
      lastSpeechAtRef.current = now
      return false
    }
    return now - lastSpeechAtRef.current >= SILENCE_TIMEOUT_MS
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
        toast.error(t('audio.noAudioCaptured'))
        return
      }

      try {
        const sarvamCode = languageCode === 'unknown' ? 'unknown' : toSarvamLang(languageCode)

        // Step 2 — Transcribe via /speech/stt.
        const result = await speechApi.speechToText(blob, sarvamCode, filename)
        const text = (result.text ?? '').trim()
        if (!text) {
          setState('error')
          toast.error(t('audio.noWordsHeard'))
          return
        }
        setState('done')
        onTranscribedRef.current?.(text, blob, filename)
        toast.success(t('audio.voiceCaptured'), {
          description: text.length > 80 ? text.slice(0, 80) + '…' : text,
        })
      } catch (err) {
        console.error('[MicButton] speechToText error:', err)
        const msg = err instanceof Error ? err.message : t('audio.transcribeError')
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
      toast.error(t('audio.couldNotStop'))
    }
  }, [cleanupStream, languageCode])

  const startRecording = useCallback(async () => {
    if (!supported) {
      toast.error(t('audio.notSupportedBrowser'))
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
      startSilenceMonitor(stream)

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
        toast.error(t('audio.recordingFailed'))
        cleanupStream()
      }

      mediaRecorderRef.current = recorder
      recorder.start(250) // 250 ms chunks → bounded blob size even on abrupt stop
      startTimeRef.current = Date.now()
      setElapsedMs(0)
      setState('recording')

      // 4 Hz ticker for the duration badge and silence auto-stop
      tickerRef.current = setInterval(() => {
        const now = Date.now()
        if (startTimeRef.current != null) {
          setElapsedMs(now - startTimeRef.current)
        }
        if (hasBeenSilentTooLong(now)) {
          toast.info(t('audio.stoppedForSilence', 'No speech detected for 1 minute, so recording was stopped.'))
          stopRecording()
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
          ? t('audio.permissionDeniedRetry')
          : t('audio.couldNotStart')
      toast.error(msg)
      cleanupStream()
      setState('error')
    }
  }, [cleanupStream, stopRecording, supported, maxDurationMs, startSilenceMonitor, hasBeenSilentTooLong])

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
    ? t('audio.notSupportedShort')
    : isUploading
      ? t('audio.transcribing')
      : isFinal
        ? t('audio.doneSpeakAgain')
        : isRecording
          ? t('audio.tapToStopRecording')
          : t('question.tapMicHint')

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
          aria-label={isRecording ? t('audio.stopRecordingAria') : t('audio.startRecordingAria')}
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