import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react'
import type { AIValidationResult } from '@/utils/onDeviceAI'
import { cn } from '@/lib/utils'

type BannerVariant = 'warning' | 'error' | 'info'

interface AIValidationBannerProps {
  result: AIValidationResult
  /** Called when user taps the close ("×") button. */
  onDismiss?: () => void
  className?: string
}

function resolveVariant(verdict: AIValidationResult['verdict']): BannerVariant {
  if (verdict === 'fail') return 'error'
  if (verdict === 'warn') return 'warning'
  return 'info'
}

function variantClasses(variant: BannerVariant) {
  // Tailwind needs the literal class names — not interpolation — for
  // purge/content-watching to detect them. Inline both sets explicitly.
  switch (variant) {
    case 'error':
      return {
        container: 'border-destructive/40 bg-destructive/10 text-destructive',
        icon: 'text-destructive',
        close: 'text-destructive/80 hover:bg-destructive/20',
      }
    case 'warning':
      return {
        container: 'border-warning/40 bg-warning/10 text-warning',
        icon: 'text-warning',
        close: 'text-warning/80 hover:bg-warning/20',
      }
    case 'info':
    default:
      return {
        container: 'border-info/40 bg-info/10 text-info',
        icon: 'text-info',
        close: 'text-info/80 hover:bg-info/20',
      }
  }
}

function resolveIcon(variant: BannerVariant) {
  if (variant === 'error') return ShieldAlert
  if (variant === 'warning') return AlertTriangle
  return Info
}

/**
 * Inline banner that surfaces the on-device AI validation result.
 *
 * Mirrors `mobile/src/components/AIValidationBanner.tsx`:
 *   • Renders nothing when the pipeline didn't run or verdict = 'pass'
 *   • Maps verdict → variant (fail → error, warn → warning)
 *   • Exposes a dismiss button when `onDismiss` is provided
 */
export function AIValidationBanner({ result, onDismiss, className }: AIValidationBannerProps) {
  if (!result.ran || result.verdict === 'pass' || !result.message) {
    return null
  }

  const variant = resolveVariant(result.verdict)
  const Icon = resolveIcon(variant)
  const cls = variantClasses(variant)

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs sm:text-xs sm:text-sm',
        cls.container,
        className,
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', cls.icon)} aria-hidden />
      <p className="flex-1 leading-snug">{result.message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            '-mr-1 -mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors',
            cls.close,
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}