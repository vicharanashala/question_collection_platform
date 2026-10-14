import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type CameraError = 'denied' | 'notFound' | 'inUse' | 'insecure' | 'unsupported' | 'unknown'

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

export function CameraCaptureModal({ open, onOpenChange, onCapture }: CameraCaptureModalProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'starting' | 'live' | 'error'>('starting')
  const [error, setError] = useState<CameraError>('unknown')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setStatus('starting')

    async function start() {
      if (!window.isSecureContext) { setError('insecure'); setStatus('error'); return }
      if (!navigator.mediaDevices?.getUserMedia) { setError('unsupported'); setStatus('error'); return }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
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
  }, [open])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) { setError('unknown'); setStatus('error'); return }
        onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }))
        onOpenChange(false)
      },
      'image/jpeg',
      0.92,
    )
  }

  const messages: Record<CameraError, string> = {
    denied: t('agriEntity.camera.denied', 'Camera access was blocked. Allow camera permission for this site in your browser settings, or add a photo from your files instead.'),
    notFound: t('agriEntity.camera.notFound', 'No camera was found on this device. You can add a photo from your files instead.'),
    inUse: t('agriEntity.camera.inUse', 'The camera is being used by another app. Close it and try again.'),
    insecure: t('agriEntity.camera.insecure', 'The camera needs a secure (HTTPS) connection.'),
    unsupported: t('agriEntity.camera.unsupported', 'This browser does not support camera capture. You can add a photo from your files instead.'),
    unknown: t('agriEntity.camera.unknown', 'The camera could not be started. Please try again or add a photo from your files.'),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('agriEntity.takePhoto', 'Take photo')}</DialogTitle>
        </DialogHeader>

        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {status === 'starting' && (
            <div role="status" className="absolute inset-0 flex items-center justify-center text-white">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span className="sr-only">{t('agriEntity.camera.starting', 'Starting camera…')}</span>
            </div>
          )}
        </div>

        {status === 'error' && (
          <p role="alert" className="text-sm text-rose-600">{messages[error]}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={capture} disabled={status !== 'live'} className="gap-2">
            <Camera className="h-4 w-4" aria-hidden="true" />
            {t('agriEntity.camera.capture', 'Capture')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}