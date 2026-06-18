import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import {
  ChevronLeft, ChevronRight, Search,
  ChevronUp, ChevronDown, ChevronsUpDown,
  LayoutGrid, List, SlidersHorizontal, X,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc'

export interface ColumnDef<T> {
  key: string
  header: string
  width?: string
  sortable?: boolean
  filterable?: boolean
  filterOptions?: { value: string; label: string }[]
  render: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  loading?: boolean
  page: number
  totalPages: number
  totalCount: number
  searchValue: string
  onSearchChange: (v: string) => void
  onPageChange: (p: number) => void
  SkeletonRows?: number
  emptyMessage?: string
  onRowClick?: (row: T) => void
}

interface CardViewProps<T extends { id: string }> {
  data: T[]
  columns: ColumnDef<T>[]
  loading?: boolean
  SkeletonRows?: number
  emptyMessage?: string
  onRowClick?: (row: T) => void
  /** Highlight the card with this id with a visible selection border */
  selectedId?: string
}

// ─── Shared skeleton ────────────────────────────────────────────────────────────

export function DataTableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0 border border-border-subtle rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/60 border-b border-border-subtle">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={cn('h-3.5 rounded bg-muted animate-pulse', i === 0 ? 'w-24' : 'flex-1')} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle last:border-0">
          {Array.from({ length: cols }).map((_, ci) => (
            <div key={ci} className={cn('h-3.5 rounded bg-muted animate-pulse', ci === 0 ? 'w-24' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardViewSkeleton({ rows = 4, cols = 2 }: { rows?: number; cols?: number }) {
  return (
    <div className={cn('grid gap-3', cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="rounded-xl border border-border-subtle p-4 space-y-3">
          <div className="flex gap-2">
            <div className="h-5 w-20 rounded bg-muted animate-pulse" />
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// ─── Sort helper ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSortValue(row: any, key: string): string | number {
  const val = row[key]
  if (val == null) return ''
  if (typeof val === 'number') return val
  if (typeof val === 'string') return val.toLowerCase()
  return String(val)
}

// ─── Filter bar ─────────────────────────────────────────────────────────────────

interface FilterState {
  [columnKey: string]: string[]   // selected values per column
}

interface ActiveFiltersBarProps {
  filters: FilterState
  columns: ColumnDef<unknown>[]
  onRemove: (key: string, value: string) => void
  onClearAll: () => void
}

function ActiveFiltersBar({ filters, columns, onRemove, onClearAll }: ActiveFiltersBarProps) {
  const entries = Object.entries(filters).filter(([, vals]) => vals.length > 0)
  if (entries.length === 0) return null

  return (
    <div className="flex items-center flex-wrap gap-2">
      <span className="text-xs text-muted-foreground shrink-0">Active filters:</span>
      {entries.map(([key, values]) => {
        const col = columns.find((c) => c.key === key)
        const label = col?.header ?? key
        return values.map((v) => {
          const opt = col?.filterOptions?.find((o) => o.value === v)
          const display = opt?.label ?? v
          return (
            <Badge
              key={`${key}:${v}`}
              variant="secondary"
              className="flex items-center gap-1 pl-2 pr-1.5 text-xs font-medium"
            >
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}:</span>
              {display}
              <button
                className="ml-0.5 rounded hover:bg-muted transition-colors"
                onClick={() => onRemove(key, v)}
                aria-label={`Remove ${display} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )
        })
      })}
      <button
        onClick={onClearAll}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
      >
        Clear all
      </button>
    </div>
  )
}

// ─── DataTable ─────────────────────────────────────────────────────────────────

export function DataTable<T>({
  data,
  columns,
  loading,
  page,
  totalPages,
  totalCount,
  searchValue,
  onSearchChange,
  onPageChange,
  SkeletonRows = 5,
  emptyMessage = 'No records found',
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [colFilters, setColFilters] = useState<FilterState>({})

  const filterableColumns = columns.filter((col) => col.filterable && col.filterOptions && col.filterOptions.length > 0)
  const hasActiveFilters = Object.values(colFilters).some((v) => v.length > 0)

  // Build unique options from data for filterable columns that have no pre-defined options
  const derivedOptions = useMemo(() => {
    const map: Record<string, Map<string, string>> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.forEach((row: any) => {
      filterableColumns.forEach((col) => {
        if (col.filterOptions && col.filterOptions.length > 0) return  // skip predefined
        const val = row[col.key]
        if (val == null) return
        const s = String(val)
        if (!map[col.key]) map[col.key] = new Map()
        if (!map[col.key].has(s)) map[col.key].set(s, s)
      })
    })
    return map
  }, [data, filterableColumns])

  function getOptions(col: ColumnDef<T>) {
    if (col.filterOptions && col.filterOptions.length > 0) return col.filterOptions
    const derived = derivedOptions[col.key]
    if (!derived) return []
    return Array.from(derived.entries()).map(([value, label]) => ({ value, label }))
  }

  // Client-side filter
  const filtered = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any[]).filter((row) => {
      return Object.entries(colFilters).every(([key, selected]) => {
        if (selected.length === 0) return true
        const val = row[key]
        return selected.includes(String(val ?? ''))
      })
    })
  }, [data, colFilters])

  // Client-side sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, sortKey)
      const bv = getSortValue(b, sortKey)
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleFilter(key: string, value: string) {
    setColFilters((prev) => {
      const current = prev[key] ?? []
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  function clearFilter(key: string) {
    setColFilters((prev) => ({ ...prev, [key]: [] }))
  }

  function clearAllFilters() {
    setColFilters({})
  }

  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />
  }

  const totalRows = totalCount  // original unfiltered count from parent
  const showingCount = sorted.length

  return (
    <div className="space-y-3">

      {/* ── Search + Filter controls ────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-4"
          />
        </div>

        {/* Advanced filter dropdowns */}
        {filterableColumns.map((col) => {
          const options = getOptions(col)
          if (options.length === 0) return null
          const selected = colFilters[col.key] ?? []
          const label = col.header

          return (
            <DropdownMenu key={col.key}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'h-8 gap-1.5 text-xs px-2.5',
                    selected.length > 0 && 'border-primary/50 bg-primary/5 text-primary',
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {label}
                  {selected.length > 0 && (
                    <span className="ml-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {selected.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px] max-h-[280px] overflow-y-auto">
                {/* Select All / None */}
                <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border-subtle">
                  <button
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => clearFilter(col.key)}
                  >
                    {selected.length === 0 ? 'Select all' : 'Clear'}
                  </button>
                </div>

                {options.map((opt) => {
                  const checked = selected.includes(opt.value)
                  return (
                    <DropdownMenuCheckboxItem
                      key={opt.value}
                      checked={checked}
                      onCheckedChange={() => toggleFilter(col.key, opt.value)}
                    >
                      {opt.label}
                    </DropdownMenuCheckboxItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        })}

        {/* Results count */}
        {hasActiveFilters && (
          <span className="text-xs text-muted-foreground shrink-0 ml-auto">
            {showingCount} of {totalRows} result{totalRows !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Active filters chips ─────────────────────────── */}
      <ActiveFiltersBar
        filters={colFilters}
        columns={columns as ColumnDef<unknown>[]}
        onRemove={toggleFilter}
        onClearAll={clearAllFilters}
      />

      {/* ── Table ───────────────────────────────────────── */}
      <div className="border border-border-subtle rounded-xl overflow-hidden">
        {loading ? (
          <DataTableSkeleton rows={SkeletonRows} cols={columns.length} />
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            {hasActiveFilters && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={clearAllFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/60 border-b border-border-subtle overflow-x-auto">
              {columns.map((col) => (
                <div
                  key={col.key}
                  className={cn(
                    'flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0',
                    col.sortable && 'cursor-pointer hover:text-foreground transition-colors',
                  )}
                  style={{ width: col.width, minWidth: col.width }}
                  onClick={() => col.sortable && toggleSort(col.key)}
                >
                  {col.header}
                  {col.sortable && <SortIcon colKey={col.key} />}
                </div>
              ))}
            </div>

            {/* Data rows */}
            {sorted.map((row, idx) => (
              <div
                key={String((row as Record<string, unknown>).id ?? idx)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 border-b border-border-subtle last:border-0 hover:bg-accent/40 transition-colors',
                  onRowClick && 'cursor-pointer',
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className="shrink-0 text-sm text-foreground"
                    style={{ width: col.width, minWidth: col.width }}
                  >
                    {col.render(row)}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Pagination ──────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {(page - 1) * showingCount + 1}–{Math.min(page * showingCount, totalCount)} of {totalCount.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2 min-w-[80px] text-center tabular-nums">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── View toggle ───────────────────────────────────────────────────────────────

export function ViewToggle({
  view,
  onChange,
}: {
  view: 'table' | 'card'
  onChange: (v: 'table' | 'card') => void
}) {
  return (
    <div className="flex items-center border border-border-subtle rounded-lg overflow-hidden shrink-0">
      <button
        onClick={() => onChange('table')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
          view === 'table'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        title="Table view"
      >
        <List className="h-3.5 w-3.5" />
        Table
      </button>
      <button
        onClick={() => onChange('card')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
          view === 'card'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
        title="Card view"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Card
      </button>
    </div>
  )
}

// ─── Card View ─────────────────────────────────────────────────────────────────

export function CardView<T extends { id: string }>({
  data,
  columns,
  loading,
  SkeletonRows = 4,
  emptyMessage = 'No records found',
  onRowClick,
  selectedId,
}: CardViewProps<T>) {
  if (loading) {
    return <CardViewSkeleton rows={SkeletonRows} cols={3} />
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 border border-border-subtle rounded-xl">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {data.map((row) => {
        const labelCol = columns[0]
        const subCol   = columns[1]
        const metaCols = columns.slice(2)

        const isSelected = selectedId === row.id
        return (
          <div
            key={row.id}
            onClick={() => onRowClick?.(row)}
            className={cn(
              'rounded-xl border bg-card overflow-hidden',
              isSelected
                ? 'border-primary border-2 shadow-md ring-2 ring-primary/20'
                : 'border-border-subtle hover:border-primary/30 hover:shadow-sm',
              'transition-all duration-150 cursor-pointer',
            )}
          >
            <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-border-subtle bg-muted/30">
              <div className="min-w-0 flex-1">
                {labelCol && (
                  <div className="mb-1.5">{labelCol.render(row)}</div>
                )}
                {subCol && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {subCol.render(row)}
                  </p>
                )}
              </div>
            </div>

            <div className="px-4 py-3 space-y-1.5">
              {metaCols.map((col) => (
                <div key={col.key} className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 min-w-[80px]">
                    {col.header}
                  </span>
                  <span className="text-xs text-foreground font-medium leading-snug">
                    {col.render(row)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Table + Card wrapper (dual view) ─────────────────────────────────────────

interface DualViewProps {
  view: 'table' | 'card'
  tableComponent: React.ReactNode
  cardComponent: React.ReactNode
}

export function DualView({
  view,
  tableComponent,
  cardComponent,
}: DualViewProps) {
  return (
    <div className="space-y-3">
      {view === 'table' ? tableComponent : cardComponent}
    </div>
  )
}