import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectItem {
  value: string
  label: string
}

interface SearchableSelectProps {
  items: SelectItem[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  className?: string
  emptyMessage?: string
  /** When true, shows an "Enter manually…" option when the dropdown is open and items are empty (post-load). */
  allowFreeText?: boolean
  /** Called when user clicks "Enter manually…" to opt into free-text entry. */
  onFreeTextEntry?: () => void
}

export function SearchableSelect({
  items,
  value,
  onValueChange,
  placeholder = 'Search…',
  disabled,
  loading,
  className,
  emptyMessage = 'No results found.',
  allowFreeText,
  onFreeTextEntry,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  // Sync search reset when dropdown closes
  React.useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  // When opening, focus the input
  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selectedLabel = items.find((i) => i.value === value)?.label

  return (
    <div className={cn('relative', className)} ref={listRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-border-subtle bg-surface px-3 py-2 text-xs sm:text-xs sm:text-sm',
          'placeholder:text-text-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'ring-2 focus:ring-focus',
          !selectedLabel && 'text-text-tertiary',
        )}
      >
        <span className={cn(!selectedLabel && 'text-text-tertiary')}>
          {selectedLabel ?? placeholder}
        </span>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-w-[90vw] sm:max-w-none rounded-md border border-border-subtle bg-surface shadow-lg">
          {/* Search input */}
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

          {/* Free-text option — shown only when items are empty (backend returned nothing) and allowFreeText is set */}
          {allowFreeText && items.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onFreeTextEntry?.()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50 border-t border-border-subtle"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-emerald-400 text-[10px] font-bold text-emerald-600">+</span>
              Enter manually…
            </button>
          )}

          {/* Command list */}
          <CommandPrimitive
            filter={(value, search) => {
              const item = items.find((i) => i.value === value)
              if (!item) return -1
              const needle = search.toLowerCase()
              return item.label.toLowerCase().includes(needle) ? 1 : -1
            }}
            className="overflow-y-auto max-h-48 sm:max-h-52 p-1"
          >
            <CommandPrimitive.List className="p-1">
              <CommandPrimitive.Empty className="py-3 text-center text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">
                {emptyMessage}
              </CommandPrimitive.Empty>
              <CommandPrimitive.Group className="p-1">
                {items
                  .filter((item) =>
                    !search ||
                    item.label.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((item) => (
                    <CommandPrimitive.Item
                      key={item.value}
                      value={item.value}
                      onSelect={() => {
                        onValueChange(item.value)
                        setOpen(false)
                      }}
                      className={cn(
                        'relative flex w-full cursor-default select-none items-center rounded-sm py-2 pl-8 pr-2 text-xs sm:text-xs sm:text-sm outline-none',
                        'focus:bg-surface-variant focus:text-foreground',
                        'data-[selected=true]:bg-emerald-50 data-[selected=true]:text-emerald-700 dark:data-[selected=true]:bg-emerald-950 dark:data-[selected=true]:text-emerald-300',
                        item.value === value &&
                          'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                      )}
                    >
                      <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
                        {item.value === value && (
                          <Check className="h-4 w-4 text-emerald-600" />
                        )}
                      </span>
                      {item.label}
                    </CommandPrimitive.Item>
                  ))}
              </CommandPrimitive.Group>
            </CommandPrimitive.List>
          </CommandPrimitive>
        </div>
      )}
    </div>
  )
}