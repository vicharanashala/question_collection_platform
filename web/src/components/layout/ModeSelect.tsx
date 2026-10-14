import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ModeScope } from '@/lib/modeStore'

interface ModeSelectProps {
  ariaLabel: string
  icon: LucideIcon
  value: ModeScope
  onChange: (value: ModeScope) => void
  labels: Record<ModeScope, string>
  /** Tailwind colour classes for the active state, e.g. emerald or amber. */
  activeClass: string
  activeTint: string
}

/** Compact header dropdown for a staff data scope with an animated active state. */
export function ModeSelect({ ariaLabel, icon: Icon, value, onChange, labels, activeClass, activeTint }: ModeSelectProps) {
  const isActive = value !== 'all'
  return (
    <motion.div
      animate={{ backgroundColor: isActive ? activeTint : 'rgba(0, 0, 0, 0)' }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-1 rounded-full border border-border-subtle pl-2.5"
    >
      <motion.span animate={{ rotate: isActive ? 0 : -25, scale: isActive ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
        <Icon className={cn('h-4 w-4 text-text-secondary', isActive && activeClass)} aria-hidden="true" />
      </motion.span>
      <Select value={value} onValueChange={(next) => onChange(next as ModeScope)}>
        <SelectTrigger aria-label={ariaLabel} className="h-8 w-auto gap-1.5 border-0 bg-transparent px-2 text-xs font-semibold shadow-none focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {(Object.keys(labels) as ModeScope[]).map((scope) => (
            <SelectItem key={scope} value={scope}>{labels[scope]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </motion.div>
  )
}
