import { useState, type ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface InfoTipProps {
  /** Visible trigger: an icon or a short label. */
  children: ReactNode
  /** Full explanation shown in the tooltip. */
  content: ReactNode
  /** Accessible name for the trigger when it is icon-only. */
  label?: string
  className?: string
}

// Tooltip that opens on hover and keyboard focus, and also on tap so it works on touch screens.
export function InfoTip({ children, content, label, className }: InfoTipProps) {
  const [open, setOpen] = useState(false)

  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-[min(20rem,calc(100vw-2rem))] leading-relaxed">
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
