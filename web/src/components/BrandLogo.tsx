import logoUrl from '@/assets/logo.png'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  /**
   * Tailwind sizing classes, e.g. `"h-9 w-9"` or `"h-16 w-16"`.
   * The PNG is rendered with `object-contain` so it always fits the box
   * without distortion (the artwork is a square so it fills the box).
   */
  className?: string
  /** Optional alt text override; defaults to the platform name. */
  alt?: string
}

/**
 * AnnaDatha brand logo — circular green mark with a white leaf and a
 * small accent dot in the upper-right. Sourced from `src/assets/logo.png`
 * and bundled by Vite (gets a content-hash filename in production).
 *
 * Use anywhere a brand mark is needed (sidebar, mobile drawer, auth pages,
 * favicon, OG cards, etc). For the browser-tab favicon, link to the static
 * `/logo.png` served from `web/public/`.
 */
export function BrandLogo({ className, alt = 'AnnaDatha' }: BrandLogoProps) {
  return (
    <img
      src={logoUrl}
      alt={alt}
      draggable={false}
      className={cn('block h-full w-full select-none object-contain', className)}
    />
  )
}