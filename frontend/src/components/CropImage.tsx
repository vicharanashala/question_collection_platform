import { useState } from 'react'
import { Leaf } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CropImageProps {
  /** Image URL from the crops API. */
  imageUrl?: string | null
  className?: string
  iconClassName?: string
}

/**
 * Circular crop thumbnail. Shows the image supplied by the crops API, and a
 * generic leaf placeholder when a crop has no image or the image fails to load.
 */
export function CropImage({ imageUrl, className, iconClassName }: CropImageProps) {
  const [failed, setFailed] = useState(false)

  if (!imageUrl || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40', className)}>
        <Leaf className={cn('h-1/2 w-1/2 text-emerald-400 dark:text-emerald-600', iconClassName)} />
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt=""
      className={cn('object-cover', className)}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
