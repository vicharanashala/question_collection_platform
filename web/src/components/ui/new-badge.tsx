import { cn } from '@/lib/utils'
import { useIsNewFeature, type NewFeatureKey } from '@/lib/newFeatures'

interface NewBadgeProps {
  feature: NewFeatureKey
  className?: string
}

// Small "New" pill that renders only while the given feature is still new.
export function NewBadge({ feature, className }: NewBadgeProps) {
  const isNew = useIsNewFeature(feature)
  if (!isNew) return null
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full bg-rose-500 px-1.5 py-px text-[9px] font-bold uppercase leading-4 tracking-wider text-white shadow-sm',
        className,
      )}
    >
      New
    </span>
  )
}
