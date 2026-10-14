import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sprout } from 'lucide-react'
import { SubmissionTypeTabs } from '@/components/agri-entity/SubmissionTypeTabs'
import { AgriEntitySubmissionsList } from '@/components/agri-entity/AgriEntitySubmissionsList'
import { AGRI_ENTITY_TYPES } from '@/constants/public'
import type { AgriEntityType } from '@/types'

// Reads the active type from the URL, falling back to crop.
function parseType(value: string | null): AgriEntityType {
  return AGRI_ENTITY_TYPES.find((type) => type.value === value)?.value ?? 'crop'
}

/** Staff view of every user's crop / weed / pest / disease submissions. */
export function AgriEntitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeType = parseType(searchParams.get('tab'))
  const typeLabel = AGRI_ENTITY_TYPES.find((type) => type.value === activeType)?.label ?? ''

  // Left and right arrow keys switch the tab, unless typing or a dialog is open.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="tablist"]')) return
      if (document.querySelector('[role="dialog"]')) return
      const index = AGRI_ENTITY_TYPES.findIndex((type) => type.value === activeType)
      const next = AGRI_ENTITY_TYPES[index + (event.key === 'ArrowRight' ? 1 : -1)]
      if (next) setSearchParams({ tab: next.value }, { replace: true })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeType, setSearchParams])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <Sprout className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Agri Entities</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Crop, weed, pest and disease records submitted by all users
          </p>
        </div>
      </div>

      <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        Tip: press
        <kbd className="rounded border border-border-subtle bg-muted px-1.5 py-0.5 font-sans text-[11px] font-semibold text-foreground">←</kbd>
        <kbd className="rounded border border-border-subtle bg-muted px-1.5 py-0.5 font-sans text-[11px] font-semibold text-foreground">→</kbd>
        to switch between tabs
      </p>

      <SubmissionTypeTabs
        value={activeType}
        showQuestion={false}
        onChange={(tab) => setSearchParams({ tab }, { replace: true })}
      />

      <AgriEntitySubmissionsList key={activeType} type={activeType} typeLabel={typeLabel} scope="all" />
    </div>
  )
}
