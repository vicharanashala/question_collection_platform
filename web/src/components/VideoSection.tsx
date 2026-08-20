import { useState } from 'react'
import { Play, X, VideoOff } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
/// <reference types="vite/client" />

/**
 * YouTube embed URL (e.g. https://www.youtube.com/embed/VIDEO_ID?rel=0&modestbranding=1)
 * Set VITE_PUBLIC_FAQ_VIDEO_URL in web/.env
 * Set VITE_PUBLIC_FAQ_VIDEO_DISABLED=true to disable the video section while keeping it visible.
 */
const VIDEO_URL = (import.meta as any).env?.VITE_PUBLIC_FAQ_VIDEO_URL as string | undefined
const VIDEO_DISABLED = (import.meta as any).env?.VITE_PUBLIC_FAQ_VIDEO_DISABLED === 'true'

function isYouTubeEmbedUrl(url: string): boolean {
  return /youtube\.com\/embed\//.test(url)
}

export function VideoSection() {
  const [open, setOpen] = useState(false)

  // No URL configured — show nothing
  if (!VIDEO_URL) return null

  // Disabled via env — show muted non-interactive button
  if (VIDEO_DISABLED) {
    return (
      <div className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border-subtle bg-surface opacity-50 cursor-not-allowed">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <VideoOff className="h-5 w-5 text-text-tertiary" />
        </div>
        <div className="text-left">
          <p className="text-xs font-semibold text-foreground">Watch Video Guide</p>
          <p className="text-[11px] text-muted-foreground">Video guide coming soon</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Trigger button */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface hover:bg-surface-variant/60 transition-colors group"
        onClick={() => setOpen(true)}
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
          <Play className="h-5 w-5 text-primary fill-primary ml-0.5" />
        </div>
        <div className="text-left">
          <p className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground">Watch Video Guide</p>
          <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">Tap to watch the FAQ video</p>
        </div>
      </button>

      {/* Video modal */}
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0">
          {/* Modal header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <p className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground">Video Guide</p>
            <button
              className="p-1.5 rounded-md hover:bg-surface-variant transition-colors text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Video player */}
          <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
            {isYouTubeEmbedUrl(VIDEO_URL) ? (
              <iframe
                className="w-full h-full"
                src={VIDEO_URL}
                title="FAQ Video Guide"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                className="w-full h-full"
                src={VIDEO_URL}
                controls
                autoPlay
                preload="metadata"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}