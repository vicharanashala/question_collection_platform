import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Re-export the single-select component from the original file so consumers
// can import both variants from this one module.
export { SearchableSelect, type SelectItem } from './searchable-select'

interface MultiSearchableSelectProps {
  items: SelectItem[]
  values: string[]
  onValuesChange: (values: string[]) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  className?: string
  emptyMessage?: string
  /** Maximum number of items the user can select. Defaults to unlimited. */
  maxSelected?: number
  /** Optional helper text rendered below the trigger. */
  helperText?: string
}

/**
 * Searchable multi-select — like {@link SearchableSelect} but accepts an
 * array of selected values and toggles individual items on click.
 *
 * Trigger shows either a "X selected" summary or the labels of up to 2
 * selected items; the open dropdown shows each item with a checkbox
 * indicator. Useful for fields like "operating state(s)" where a user
 * may legitimately operate in more than one Indian state.
 */
export function MultiSearchableSelect({
  items,
  values,
  onValuesChange,
  placeholder = 'Search…',
  disabled,
  loading,
  className,
  emptyMessage = 'No results found.',
  maxSelected,
  helperText,
}: MultiSearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  React.useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectedSet = React.useMemo(() => new Set(values), [values])
  const limitReached = !!maxSelected && values.length >= maxSelected

  function toggleValue(v: string) {
    if (selectedSet.has(v)) {
      onValuesChange(values.filter((x) => x !== v))
    } else if (!limitReached) {
      onValuesChange([...values, v])
    }
  }

  function removeValue(v: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    onValuesChange(values.filter((x) => x !== v))
  }

  const filteredItems = items.filter(
    (item) =>
      !search || item.label.toLowerCase().includes(search.toLowerCase()),
  )

  let triggerLabel: React.ReactNode
  if (values.length === 0) {
    triggerLabel = <span className="text-text-tertiary">{placeholder}</span>
  } else if (values.length <= 2) {
    triggerLabel = (
      <span className="flex flex-wrap items-center gap-1">
        {values.map((v) => {
          const item = items.find((i) => i.value === v)
          return (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            >
              {item?.label ?? v}
              <button
                type="button"
                onClick={(e) => removeValue(v, e)}
                className="leading-none hover:text-rose-500"
                aria-label={`Remove ${item?.label ?? v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )
        })}
      </span>
    )
  } else {
    triggerLabel = <span className="text-foreground">{values.length} selected</span>
  }

  return (
    <div className={cn('relative', className)} ref={listRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          'flex h-auto min-h-[40px] w-full items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface px-3 py-2 text-xs sm:text-xs sm:text-sm text-left',
          'placeholder:text-text-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'ring-2 focus:ring-focus',
        )}
      >
        <span className="flex-1 truncate">{triggerLabel}</span>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        )}
      </button>

      {helperText && (
        <p className="mt-1 text-[11px] sm:text-xs text-text-tertiary">{helperText}</p>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full max-w-[90vw] sm:max-w-none rounded-md border border-border-subtle bg-surface shadow-lg">
          <div className="flex items-center border-b border-border-subtle px-3">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false)
                  inputRef.current?.blur()
                }
              }}
              placeholder={placeholder}
              className="h-9 flex-1 bg-transparent text-xs sm:text-xs sm:text-sm text-foreground placeholder:text-text-tertiary outline-none"
            />
          </div>

          {limitReached && (
            <p className="border-b border-border-subtle px-3 py-2 text-[11px] sm:text-xs text-amber-600">
              You can select up to {maxSelected} items.
            </p>
          )}

          <CommandPrimitive
            filter={(value, search) => {
              const item = items.find((i) => i.value === value)
              if (!item) return -1
              const needle = search.toLowerCase()
              return item.label.toLowerCase().includes(needle) ? 1 : -1
            }}
            className="overflow-y-auto max-h-56 sm:max-h-60 p-1"
          >
            <CommandPrimitive.List className="p-1">
              <CommandPrimitive.Empty className="py-3 text-center text-[11px] sm:text-xs text-muted-foreground">
                {emptyMessage}
              </CommandPrimitive.Empty>
              <CommandPrimitive.Group className="p-1">
                {filteredItems.map((item) => {
                  const checked = selectedSet.has(item.value)
                  const disabledItem = !checked && limitReached
                  return (
                    <CommandPrimitive.Item
                      key={item.value}
                      value={item.value}
                      disabled={disabledItem}
                      onSelect={() => toggleValue(item.value)}
                      className={cn(
                        'relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-8 pr-2 text-xs sm:text-xs sm:text-sm outline-none',
                        'focus:bg-surface-variant focus:text-foreground',
                        'data-[selected=true]:bg-surface-variant',
                        checked &&
                          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                        disabledItem && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                        {checked ? (
                          <span className="flex h-4 w-4 items-center justify-center rounded border border-emerald-500 bg-emerald-500 text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : (
                          <span className="flex h-4 w-4 items-center justify-center rounded border border-border-subtle" />
                        )}
                      </span>
                      {item.label}
                    </CommandPrimitive.Item>
                  )
                })}
              </CommandPrimitive.Group>
            </CommandPrimitive.List>
          </CommandPrimitive>
        </div>
      )}
    </div>
  )
}