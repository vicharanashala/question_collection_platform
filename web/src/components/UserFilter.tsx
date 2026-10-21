import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { agriEntityApi, getErrorMessage, type UserFilterOption } from '@/api/client'
import { useAnveshanScope } from '@/lib/anveshanMode'
import { useTesterScope } from '@/lib/testerMode'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select'

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
  const anveshanScope = useAnveshanScope()
  const testerScope = useTesterScope()
  // The header tester scope overrides the table's own tester filter on requests.
  const effectiveTester = testerScope !== 'all' ? testerScope : tester
  const [users, setUsers] = useState<UserFilterOption[]>([])
  const [known, setKnown] = useState<Record<string, UserFilterOption>>({})
  const [draft, setDraft] = useState<string[]>(value)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  // Loads the users allowed by the header scopes that match the search, and remembers them for selected labels.
  useEffect(() => {
    let cancelled = false
    agriEntityApi
      .listUsers({ tester: effectiveTester, search: debouncedSearch })
      .then((list) => {
        if (cancelled) return
        setUsers(list)
        setKnown((prev) => ({ ...prev, ...Object.fromEntries(list.map((u) => [u.id, u])) }))
      })
      .catch((err) => toast.error(getErrorMessage(err, 'Could not load users')))
    return () => {
      cancelled = true
    }
  }, [effectiveTester, anveshanScope, debouncedSearch])

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
      <div className="w-full sm:w-72">
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
        <Button size="sm" onClick={() => onApply(draft)} disabled={disabled}>Apply</Button>
        <Button size="sm" variant="outline" onClick={reset} disabled={!draft.length && !value.length}>Reset</Button>
      </div>
    </div>
  )
}
