import { useState } from 'react'
import { Leaf } from 'lucide-react'
import { getCropImage } from '@/lib/cropImages'
import { cn } from '@/lib/utils'

interface CropImageProps {
  name: string
  className?: string
  iconClassName?: string
}

/**
 * Circular crop thumbnail. Mirrors the mobile `Select` component's grid/list
 * thumbnails: shows the crop's bundled image when one exists, otherwise a
 * generic leaf placeholder (same fallback mobile uses).
 */
export function CropImage({ name, className, iconClassName }: CropImageProps) {
  const src = getCropImage(name)
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40', className)}>
        <Leaf className={cn('h-1/2 w-1/2 text-emerald-400 dark:text-emerald-600', iconClassName)} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className={cn('object-cover', className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
