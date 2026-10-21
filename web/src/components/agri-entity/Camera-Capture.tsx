import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Check, Clock, Loader2, MapPin, MapPinOff, RotateCcw, SwitchCamera, VideoOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import logoUrl from '@/assets/logo.png'

const APP_NAME = 'AnnaDatha'
const ORG_LINE = 'by annam.ai'

type CameraError = 'denied' | 'notFound' | 'inUse' | 'insecure' | 'unsupported' | 'unknown'
type Facing = 'environment' | 'user'

interface LocationFix {
  latitude: number
  longitude: number
  accuracy: number
}

interface LiveLocation {
  status: 'off' | 'locating' | 'ready' | 'denied' | 'unavailable'
  fix?: LocationFix
}

interface CapturedPhoto {
  blob: Blob
  url: string
}

interface CameraCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
}

function toCameraError(err: unknown): CameraError {
  switch ((err as DOMException)?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'notFound'
    case 'NotReadableError':
    case 'AbortError':
      return 'inUse'
    default:
      return 'unknown'
  }
}

// Formats a date as "21 Oct 2026, 14:32" in the user's locale.
function formatTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Formats a location fix as "Lat 12.971599, Long 77.594566".
function formatCoordinates(fix: LocationFix): string {
  return `Lat ${fix.latitude.toFixed(6)}, Long ${fix.longitude.toFixed(6)}`
}

// Returns the current time, refreshed every few seconds while active.
function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

// Tracks the device location while active. Starts on its own only when permission was already granted.
function useLiveLocation(active: boolean) {
  const [location, setLocation] = useState<LiveLocation>({ status: 'off' })
  const watchIdRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  // Starts watching and triggers the browser permission prompt when needed.
  const enable = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation({ status: 'unavailable' })
      return
    }
    stop()
    setLocation((prev) => ({ status: 'locating', fix: prev.fix }))
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) =>
        setLocation({
          status: 'ready',
          fix: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy },
        }),
      (err) => setLocation({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    )
  }, [stop])

  useEffect(() => {
    if (!active) {
      stop()
      setLocation({ status: 'off' })
      return
    }
    let cancelled = false
    const query = navigator.permissions?.query?.({ name: 'geolocation' })
    query
      ?.then((perm) => {
        if (cancelled) return
        if (perm.state === 'granted') enable()
        else if (perm.state === 'denied') setLocation({ status: 'denied' })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      stop()
    }
  }, [active, enable, stop])

  return { location, enable }
}

// Draws a dark banner along the bottom edge of the photo with the given lines on the left
// and the brand logo and name on the right.
function drawStamp(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lines: string[],
  logo: HTMLImageElement | null,
) {
  const fontSize = Math.max(16, Math.round(Math.min(width, height) * 0.032))
  const padding = Math.round(fontSize * 0.7)
  const lineHeight = Math.round(fontSize * 1.4)
  const barHeight = padding * 2 + lineHeight * lines.length
  const top = height - barHeight

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.fillRect(0, top, width, barHeight)
  ctx.textBaseline = 'top'

  // Brand block on the right: logo, app name and the organisation line.
  const logoSize = logo ? Math.min(barHeight - padding, Math.round(fontSize * 2.4)) : 0
  const gap = logo ? Math.round(fontSize * 0.5) : 0
  const orgFontSize = Math.round(fontSize * 0.78)
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
  const appNameWidth = ctx.measureText(APP_NAME).width
  ctx.font = `500 ${orgFontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
  const orgWidth = ctx.measureText(ORG_LINE).width
  const brandWidth = logoSize + gap + Math.max(appNameWidth, orgWidth)
  const brandX = width - padding - brandWidth
  const brandCenterY = top + barHeight / 2
  if (logo) {
    ctx.drawImage(logo, brandX, brandCenterY - logoSize / 2, logoSize, logoSize)
  }
  const textX = brandX + logoSize + gap
  const textBlockHeight = fontSize + orgFontSize + 2
  ctx.fillStyle = '#fff'
  ctx.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
  ctx.fillText(APP_NAME, textX, brandCenterY - textBlockHeight / 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.font = `500 ${orgFontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
  ctx.fillText(ORG_LINE, textX, brandCenterY - textBlockHeight / 2 + fontSize + 2)
  ctx.fillStyle = '#fff'

  // Detail lines on the left, kept clear of the brand block.
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
  const textMaxWidth = Math.max(width - padding * 3 - brandWidth, width * 0.3)
  lines.forEach((line, i) => {
    ctx.fillText(line, padding, top + padding + i * lineHeight, textMaxWidth)
  })
}

export function CameraCaptureModal({ open, onOpenChange, onCapture }: CameraCaptureModalProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const logoRef = useRef<HTMLImageElement | null>(null)
  const [status, setStatus] = useState<'starting' | 'live' | 'error'>('starting')
  const [error, setError] = useState<CameraError>('unknown')
  const [facing, setFacing] = useState<Facing>('environment')
  const [canSwitch, setCanSwitch] = useState(false)
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null)
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null)

  const now = useNow(open && !captured)
  const { location, enable: enableLocation } = useLiveLocation(open)

  // Starts the camera stream for the chosen side and stops it on close or when the side changes.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setStatus('starting')

    async function start() {
      if (!window.isSecureContext) { setError('insecure'); setStatus('error'); return }
      if (!navigator.mediaDevices?.getUserMedia) { setError('unsupported'); setStatus('error'); return }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        setStatus('live')
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        if (!cancelled) setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1)
      } catch (err) {
        if (cancelled) return
        setError(toCameraError(err))
        setStatus('error')
      }
    }
    void start()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [open, facing])

  // Preloads the logo so it can be drawn onto the photo at capture time.
  useEffect(() => {
    const img = new Image()
    img.onload = () => { logoRef.current = img }
    img.src = logoUrl
  }, [])

  // Drops any captured photo when the modal closes and frees its preview URL.
  useEffect(() => {
    if (!open) setCaptured(null)
  }, [open])
  useEffect(() => () => { if (captured) URL.revokeObjectURL(captured.url) }, [captured])

  // Grabs the current frame, stamps the time and location onto it, and shows it for review.
  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const takenAt = new Date()
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) { setError('unknown'); setStatus('error'); return }
    ctx.drawImage(video, 0, 0)
    drawStamp(ctx, canvas.width, canvas.height, [
      formatTimestamp(takenAt),
      location.fix
        ? formatCoordinates(location.fix)
        : t('agriEntity.camera.stampNoLocation', 'Location not available'),
    ], logoRef.current)
    canvas.toBlob(
      (blob) => {
        if (!blob) { setError('unknown'); setStatus('error'); return }
        video.pause()
        setCaptured({ blob, url: URL.createObjectURL(blob) })
      },
      'image/jpeg',
      0.92,
    )
  }

  function retake() {
    setCaptured(null)
    void videoRef.current?.play().catch(() => undefined)
  }

  function confirmPhoto() {
    if (!captured) return
    onCapture(new File([captured.blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }))
    onOpenChange(false)
  }

  const messages: Record<CameraError, string> = {
    denied: t('agriEntity.camera.denied', 'Camera access was blocked. Allow camera permission for this site in your browser settings, or add a photo from your files instead.'),
    notFound: t('agriEntity.camera.notFound', 'No camera was found on this device. You can add a photo from your files instead.'),
    inUse: t('agriEntity.camera.inUse', 'The camera is being used by another app. Close it and try again.'),
    insecure: t('agriEntity.camera.insecure', 'The camera needs a secure (HTTPS) connection.'),
    unsupported: t('agriEntity.camera.unsupported', 'This browser does not support camera capture. You can add a photo from your files instead.'),
    unknown: t('agriEntity.camera.unknown', 'The camera could not be started. Please try again or add a photo from your files.'),
  }

  const locationNotice: Record<'off' | 'denied' | 'unavailable', string> = {
    off: t('agriEntity.camera.locationOff', 'Location is off'),
    denied: t('agriEntity.camera.locationDenied', 'Location blocked in browser settings'),
    unavailable: t('agriEntity.camera.locationUnavailable', 'Location unavailable'),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          'flex h-dvh max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 bg-neutral-950 p-0 text-white',
          'left-0 top-0 translate-x-0 translate-y-0',
          'sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[92dvh] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-white/10',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <DialogTitle className="text-base font-semibold text-white">
            {captured ? t('agriEntity.camera.review', 'Review photo') : t('agriEntity.takePhoto', 'Take photo')}
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t('common.close', 'Close')}
            className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Camera stage. The picture box follows the video's aspect ratio so the overlays sit on the picture itself. */}
        <div className="flex min-h-0 flex-1 items-center justify-center bg-black sm:aspect-[4/3] sm:flex-none">
          <div
            className="relative max-h-full w-full overflow-hidden"
            style={{ aspectRatio: resolution ? `${resolution.width} / ${resolution.height}` : '4 / 3' }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              onLoadedMetadata={(e) =>
                setResolution({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight })
              }
              className={cn('h-full w-full object-contain', facing === 'user' && 'scale-x-[-1]')}
            />

            {captured && (
              <img src={captured.url} alt={t('agriEntity.camera.capturedAlt', 'Captured photo')} className="absolute inset-0 h-full w-full object-contain" />
            )}

            {status === 'starting' && (
              <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
                <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                <span className="text-sm">{t('agriEntity.camera.starting', 'Starting camera…')}</span>
              </div>
            )}

            {status === 'error' && (
              <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <VideoOff className="h-8 w-8 text-white/60" aria-hidden="true" />
                <p className="max-w-sm text-sm text-white/90">{messages[error]}</p>
              </div>
            )}

            {/* Live details bar, hidden once a photo is captured because the same details are stamped on it */}
            {status === 'live' && !captured && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/55 px-3 py-1.5 text-[11px] leading-snug text-white backdrop-blur-sm sm:text-sm">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-white/70" aria-hidden="true" />
                    <span className="truncate">{formatTimestamp(now)}</span>
                  </div>

                  <div aria-live="polite" className="flex min-w-0 items-center gap-1.5">
                    {location.fix ? (
                      <>
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                        <span className="truncate tabular-nums">{formatCoordinates(location.fix)}</span>
                      </>
                    ) : location.status === 'locating' ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-white/80" aria-hidden="true" />
                        <span className="text-white/80">{t('agriEntity.camera.locating', 'Getting location…')}</span>
                      </>
                    ) : (
                      <>
                        <MapPinOff className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden="true" />
                        <span className="truncate text-amber-300">
                          {locationNotice[location.status === 'ready' ? 'unavailable' : location.status]}
                        </span>
                        <button
                          type="button"
                          onClick={enableLocation}
                          className="ml-1 shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-neutral-900 transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                          {location.status === 'off'
                            ? t('agriEntity.camera.enableLocation', 'Enable')
                            : t('agriEntity.camera.tryAgain', 'Retry')}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Brand, matches the mark stamped on the photo */}
                <div className="flex shrink-0 items-center gap-2">
                  <img src={logoUrl} alt="" draggable={false} className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
                  <div className="leading-tight">
                    <p className="text-xs font-bold sm:text-sm">{APP_NAME}</p>
                    <p className="text-[10px] text-white/80 sm:text-xs">{ORG_LINE}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          {captured ? (
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={retake}
                className="h-12 flex-1 gap-2 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                {t('agriEntity.camera.retake', 'Retake')}
              </Button>
              <Button type="button" onClick={confirmPhoto} className="h-12 flex-1 gap-2">
                <Check className="h-4 w-4" aria-hidden="true" />
                {t('agriEntity.camera.usePhoto', 'Use photo')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center">
              <div className="flex justify-start">
                {canSwitch && (
                  <button
                    type="button"
                    onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
                    aria-label={t('agriEntity.camera.switch', 'Switch camera')}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <SwitchCamera className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={capture}
                disabled={status !== 'live'}
                aria-label={t('agriEntity.camera.capture', 'Capture')}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:opacity-40"
              >
                <Camera className="h-7 w-7 text-white" aria-hidden="true" />
              </button>
              <div />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
