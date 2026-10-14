import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ImageLightboxProps {
  images: string[]
  /** Index of the image to show; null closes the lightbox. */
  index: number | null
  title: string
  onIndexChange: (index: number | null) => void
}

/** Full size image viewer with previous and next controls and a thumbnail strip when there are several images. */
export function ImageLightbox({ images, index, title, onIndexChange }: ImageLightboxProps) {
  const isOpen = index !== null && images[index] !== undefined
  const hasMany = images.length > 1

  // Moves to the neighbouring image, wrapping around at both ends.
  const step = (delta: number) => {
    if (index === null) return
    onIndexChange((index + delta + images.length) % images.length)
  }

  useEffect(() => {
    if (!isOpen || !hasMany) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') step(-1)
      if (event.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onIndexChange(null) }}>
      <DialogContent
        overlayClassName="bg-black/80 dark:bg-black/90"
        className="z-[60] max-h-[94dvh] max-w-[calc(100vw-16px)] gap-0 overflow-hidden p-0 sm:p-0 lg:max-w-6xl"
      >
        {isOpen && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 pr-12">
              <DialogTitle className="truncate text-sm font-bold text-foreground sm:text-base">
                {title}
                {hasMany && <span className="ml-2 font-normal text-text-tertiary">{index + 1} / {images.length}</span>}
              </DialogTitle>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a href={images[index]} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open original
                </a>
              </Button>
            </div>

            <div className="relative flex h-[60dvh] items-center justify-center bg-black/5 dark:bg-black/40 sm:h-[68dvh]">
              <img src={images[index]} alt={`${title} photo ${index + 1}`} className="max-h-full max-w-full object-contain" />
              {hasMany && (
                <>
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-focus"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {hasMany && (
              <div className="flex gap-2 overflow-x-auto border-t border-border-subtle p-3">
                {images.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => onIndexChange(i)}
                    aria-label={`Show image ${i + 1}`}
                    aria-current={i === index}
                    className={cn(
                      'h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition',
                      i === index ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100',
                    )}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
