import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { agriEntityApi, getErrorMessage, type AnveshanUserOption } from '@/api/client'
import { Button } from '@/components/ui/button'
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select'

interface AnveshanUserFilterProps {
  /** Applied user ids. */
  value: string[]
  onApply: (userIds: string[]) => void
  /** Tester scope used to decide which users are listed. */
  tester?: 'only' | 'exclude'
  disabled?: boolean
}

// Super Admin multi-select of Anveshan users with Apply and Reset controls.
export function AnveshanUserFilter({ value, onApply, tester, disabled }: AnveshanUserFilterProps) {
  const [users, setUsers] = useState<AnveshanUserOption[]>([])
  const [draft, setDraft] = useState<string[]>(value)

  // Loads the users allowed by the tester and Anveshan scopes and drops selections that are no longer listed.
  useEffect(() => {
    agriEntityApi
      .listAnveshanUsers(tester)
      .then((list) => {
        setUsers(list)
        const listed = new Set(list.map((u) => u.id))
        setDraft((ids) => ids.filter((id) => listed.has(id)))
        if (value.some((id) => !listed.has(id))) onApply(value.filter((id) => listed.has(id)))
      })
      .catch((err) => toast.error(getErrorMessage(err, 'Could not load Anveshan users')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tester])

  const reset = () => {
    setDraft([])
    onApply([])
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      <div className="w-full sm:w-72">
        <MultiSearchableSelect
          items={users.map((u) => ({ value: u.id, label: `${u.name} (${u.mobileNumber})` }))}
          values={draft}
          onValuesChange={setDraft}
          placeholder="Filter by Anveshan users"
          emptyMessage="No Anveshan users found"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onApply(draft)} disabled={disabled}>Apply</Button>
        <Button size="sm" variant="outline" onClick={reset} disabled={!draft.length && !value.length}>Reset</Button>
      </div>
    </div>
  )
}
