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

      <SubmissionTypeTabs
        value={activeType}
        showQuestion={false}
        onChange={(tab) => setSearchParams({ tab }, { replace: true })}
      />

      <AgriEntitySubmissionsList key={activeType} type={activeType} typeLabel={typeLabel} scope="all" />
    </div>
  )
}
