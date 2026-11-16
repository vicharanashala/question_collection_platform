import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage, type UserFilterOption } from '@/client/client'
import { useAgriEntityUsers } from '@/hooks/api/useAgriEntities'
import { useAnveshanScope } from '@/stores/anveshanMode'
import { useTesterScope } from '@/stores/testerMode'
import { useDebouncedValue } from '@/hooks/ui/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { NewBadge } from '@/components/ui/new-badge'
import { markFeatureSeen } from '@/lib/newFeatures'
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select'
import { useTranslation } from 'react-i18next'

interface UserFilterProps {
  /** Applied user ids. */
  value: string[]
  onApply: (userIds: string[]) => void
  /** Tester scope used to decide which users are listed. */
  tester?: 'only' | 'exclude'
  disabled?: boolean
}

// Placeholder that names the users the current header filters allow.
function placeholderFor(anveshan: string, tester: string | undefined): string {
  const who = anveshan === 'only' ? 'Anveshan users' : anveshan === 'exclude' ? 'regular users' : 'users'
  const testers = tester === 'only' ? ' (testers only)' : tester === 'exclude' ? ' (excluding testers)' : ''
  return `Filter by ${who}${testers}`
}

const labelOf = (user: UserFilterOption) => `${user.name} (${user.mobileNumber})`

// Super Admin multi-select of users with Apply and Reset controls. The list follows the header scopes.
export function UserFilter({ value, onApply, tester, disabled }: UserFilterProps) {
  const { t } = useTranslation()
  const anveshanScope = useAnveshanScope()
  const testerScope = useTesterScope()
  // The header tester scope overrides the table's own tester filter on requests.
  const effectiveTester = testerScope !== 'all' ? testerScope : tester
  const [known, setKnown] = useState<Record<string, UserFilterOption>>({})
  const [draft, setDraft] = useState<string[]>(value)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  // Users allowed by the header scopes that match the search.
  const { data, error } = useAgriEntityUsers({ tester: effectiveTester, search: debouncedSearch })
  const users: UserFilterOption[] = data ?? []

  // Remember every user seen so selected labels survive a narrower search.
  useEffect(() => {
    if (!users.length) return
    setKnown((prev) => ({ ...prev, ...Object.fromEntries(users.map((u) => [u.id, u])) }))
  }, [users])

  useEffect(() => {
    if (error) toast.error(getErrorMessage(error, 'Could not load users'))
  }, [error])

  // Selected users stay in the list even when the current search does not return them.
  const items = [
    ...users.map((u) => ({ value: u.id, label: labelOf(u) })),
    ...draft.filter((id) => known[id] && !users.some((u) => u.id === id)).map((id) => ({ value: id, label: labelOf(known[id]) })),
  ]

  const reset = () => {
    setDraft([])
    onApply([])
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <div className="relative w-full sm:w-72">
        <NewBadge feature="entityUserFilter" className="pointer-events-none absolute -right-2 -top-2 z-10" />
        <MultiSearchableSelect
          items={items}
          values={draft}
          onValuesChange={setDraft}
          onSearchChange={setSearch}
          placeholder={placeholderFor(anveshanScope, effectiveTester)}
          emptyMessage="No users found"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { markFeatureSeen('entityUserFilter'); onApply(draft) }} disabled={disabled}>{t('userFilter.apply')}</Button>
        <Button size="sm" variant="outline" onClick={reset} disabled={!draft.length && !value.length}>{t('submissions.reset')}</Button>
      </div>
    </div>
  )
}
