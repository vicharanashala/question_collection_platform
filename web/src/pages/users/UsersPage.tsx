import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, lgdApi, getErrorMessage, type LgdState, type UserStats } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { NewBadge } from '@/components/ui/new-badge'
import { markFeatureSeen } from '@/lib/newFeatures'
import { useAnveshanScope } from '@/lib/anveshanMode'
import {
  Search, ChevronLeft, ChevronRight, Plus, Users, FlaskConical, Sprout, UserRound,
  PauseCircle, Ban, Clock, CheckCircle,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import type { User as UserType } from '@/types'
import { TesterTag } from '@/components/TesterTag'
import { ExportMenu } from '@/components/ExportMenu'
import { exportDate, type ExportColumn } from '@/lib/exportData'
import { AddUserDialog } from './AddUserDialog'
import { AnveshanProgressCell } from './AnveshanProgressCell'

type AnveshanFilter = '' | 'all' | 'completed' | 'incomplete'

const ANVESHAN_FILTER_OPTIONS: { value: AnveshanFilter; label: string }[] = [
  { value: '', label: 'All users' },
  { value: 'all', label: 'Anveshan users' },
  { value: 'completed', label: 'Anveshan · 100% complete' },
  { value: 'incomplete', label: 'Anveshan · In progress' },
]

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Categories' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'fpo', label: 'FPO' },
  { value: 'student', label: 'Student' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'ngo', label: 'NGO' },
  { value: 'anveshan_user', label: 'Anveshan User' },
]

const USER_EXPORT_COLUMNS: ExportColumn<UserType>[] = [
  { header: 'Name', value: (u) => u.name },
  { header: 'Username', value: (u) => u.username },
  { header: 'Mobile', value: (u) => u.mobileNumber },
  { header: 'Role', value: (u) => u.role },
  { header: 'Tester', value: (u) => (u.isTester ? 'TRUE' : 'FALSE') },
  { header: 'Category', value: (u) => u.category },
  { header: 'Status', value: (u) => u.verificationStatus },
  { header: 'State', value: (u) => u.state },
  { header: 'District', value: (u) => u.district },
  { header: 'Block', value: (u) => u.block },
  { header: 'Village', value: (u) => u.village },
  { header: 'Organisation Type', value: (u) => u.organisationType },
  { header: 'Joined', value: (u) => exportDate(u.createdAt) },
  { header: 'Last Login', value: (u) => exportDate(u.lastLoginAt, true) },
]

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Roles' },
  { value: 'user', label: 'User' },
  { value: 'curator', label: 'Curator' },
  { value: 'finance', label: 'Finance' },
  { value: 'distributor', label: 'Distributor' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
]

// Radix SelectItem rejects an empty value, so "All" is mapped to a sentinel.
const ALL_VALUE = '__all__'

// Small summary card showing one user count, with a placeholder while loading.
function CountCard({ icon: Icon, label, value, index }: { icon: typeof Users; label: string; value?: number; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: 'easeOut', delay: index * 0.06 }}
    >
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-text-tertiary">{label}</p>
        <p className="text-xl font-extrabold text-text">{value === undefined ? '—' : value.toLocaleString()}</p>
      </div>
    </Card>
    </motion.div>
  )
}

// Wraps one filter control with a visible label above it.
function FilterField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  )
}

function FilterSelect({ value, onChange, options, ariaLabel, className }: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  ariaLabel: string
  className?: string
}) {
  return (
    <Select value={value || ALL_VALUE} onValueChange={(v) => onChange(v === ALL_VALUE ? '' : v)}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn('w-full shrink-0 !bg-surface-variant dark:!bg-surface-variant [&>span]:truncate', className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent collisionPadding={8} className="max-h-72 max-w-[calc(100vw-1rem)]">
        {options.map((o) => (
          <SelectItem key={o.value || ALL_VALUE} value={o.value || ALL_VALUE}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const STATUS_COLORS: Record<string, string> = {
  verified: 'bg-success text-white',
  pending: 'bg-warning text-white',
  suspended: 'bg-warning text-white',
  banned: 'bg-destructive text-white',
  manual_review: 'bg-amber-500 text-white',
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  verified: CheckCircle,
  pending: Clock,
  suspended: PauseCircle,
  banned: Ban,
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'banned', label: 'Banned' },
]

// A complete YYYY-MM-DD date from the year 2000 on, as produced by a finished date input.
function isUsableDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '2000-01-01'
}

type UserSortKey = 'name' | 'role' | 'verificationStatus' | 'state' | 'createdAt' | 'lastLoginAt' | 'anveshanProgress'

// Table header cell that sorts the list by one column when clicked.
function SortableHeader({ label, sortKey, activeKey, order, onSort, newBadge }: {
  label: string
  newBadge?: boolean
  sortKey: UserSortKey
  activeKey: UserSortKey
  order: 'ASC' | 'DESC'
  onSort: (key: UserSortKey) => void
}) {
  const active = activeKey === sortKey
  const Icon = !active ? ChevronsUpDown : order === 'ASC' ? ChevronUp : ChevronDown
  return (
    <th
      className="px-4 py-3 text-left font-semibold text-text-secondary"
      aria-sort={active ? (order === 'ASC' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => { markFeatureSeen('userColumnSort'); onSort(sortKey) }}
        className={cn('inline-flex items-center gap-1 hover:text-text', active && 'text-text')}
      >
        {label}
        <Icon className={cn('h-3.5 w-3.5', !active && 'opacity-50')} aria-hidden="true" />
        {newBadge && <NewBadge feature="userColumnSort" />}
      </button>
    </th>
  )
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserType[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [sortBy, setSortBy] = useState<UserSortKey>('createdAt')
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [states, setStates] = useState<LgdState[]>([])
  const [anveshanFilter, setAnveshanFilter] = useState<AnveshanFilter>('')
  const [testerFilter, setTesterFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(false)
  const limit = 20
  const debouncedSearch = useDebouncedValue(search, 400)

  // useEffect(() => {
  //   setLoading(true)
  //   adminApi.getUsers({ page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined, role: roleFilter || undefined, excludeId: currentUser?.id })
  //     .then((res) => { setUsers(res.items); setTotal(res.total) })
  //     .catch((e) => toast.error(getErrorMessage(e, 'Failed to load users')))
  //     .finally(() => setLoading(false))
  // }, [page, debouncedSearch, statusFilter, roleFilter, currentUser?.id])


  useEffect(() => {
    lgdApi.getStates()
      .then(({ states }) => setStates(states))
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load states')))
  }, [])

  // Date filters apply once a full, sensible date is typed, so partial years like 0002 do not trigger requests.
  const debouncedFrom = useDebouncedValue(fromDate, 400)
  const debouncedTo = useDebouncedValue(toDate, 400)
  const usableFrom = isUsableDate(debouncedFrom) ? debouncedFrom : ''
  const usableTo = isUsableDate(debouncedTo) ? debouncedTo : ''
  const dateRangeInvalid = !!usableFrom && !!usableTo && usableFrom > usableTo

  useEffect(() => {
    if (dateRangeInvalid) return
    let cancelled = false
    adminApi.getUserStats({ fromDate: usableFrom, toDate: usableTo })
      .then((res) => { if (!cancelled) setStats(res) })
      .catch((e) => { if (!cancelled) toast.error(getErrorMessage(e, 'Failed to load user counts')) })
    return () => { cancelled = true }
  }, [usableFrom, usableTo, dateRangeInvalid])

  useEffect(() => {
  if (dateRangeInvalid) return
  let cancelled = false
  setLoading(true)
  adminApi.getUsers({
    page, limit,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    role: roleFilter || undefined,
    category: categoryFilter || undefined,   // ← add this
    state: stateFilter || undefined,
    anveshan: anveshanFilter || undefined,
    tester: testerFilter || undefined,
    fromDate: usableFrom || undefined,
    toDate: usableTo || undefined,
    excludeId: currentUser?.id,
    sortBy,
    sortOrder,
  })
    .then((res) => { if (!cancelled) { setUsers(res.items); setTotal(res.total) } })
    .catch((e) => { if (!cancelled) toast.error(getErrorMessage(e, 'Failed to load users')) })
    .finally(() => { if (!cancelled) setLoading(false) })
  return () => { cancelled = true }
}, [page, debouncedSearch, statusFilter, roleFilter, categoryFilter, stateFilter, anveshanFilter, testerFilter, usableFrom, usableTo, dateRangeInvalid, sortBy, sortOrder, currentUser?.id])

  // Sorts by a column, flipping the direction when it is already the active one.
  const handleSort = (key: UserSortKey) => {
    if (key === sortBy) setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'))
    else {
      setSortBy(key)
      setSortOrder(key === 'createdAt' || key === 'lastLoginAt' || key === 'anveshanProgress' ? 'DESC' : 'ASC')
    }
    setPage(1)
  }

  const totalPages = Math.ceil(total / limit)
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const anveshanScope = useAnveshanScope()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilterCount = [statusFilter, roleFilter, categoryFilter, stateFilter, testerFilter, anveshanFilter, fromDate, toDate].filter(Boolean).length
  const canFilterAnveshan = isSuperAdmin || currentUser?.role === 'admin'
  // With the header set to Anveshan only, the "All users" and "Anveshan users" choices are redundant.
  const anveshanFilterOptions =
    anveshanScope === 'only'
      ? ANVESHAN_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => (o.value === '' ? { ...o, label: 'Any progress' } : o))
      : ANVESHAN_FILTER_OPTIONS
  // Clears filters that the header scope makes irrelevant.
  useEffect(() => {
    if (anveshanScope === 'exclude') setAnveshanFilter('')
    if (anveshanScope === 'only') {
      setRoleFilter('')
      setCategoryFilter('')
    }
  }, [anveshanScope])

  const [createOpen, setCreateOpen] = useState(false)

  function handleUserCreated() {
    toast.success('User created successfully')
    setPage(1)
    adminApi.getUsers({ page: 1, limit, search: debouncedSearch || undefined, status: statusFilter || undefined, role: roleFilter || undefined, excludeId: currentUser?.id })
      .then((res) => { setUsers(res.items); setTotal(res.total) })
      .catch((error) => toast.error(getErrorMessage(error, 'User created, but the list could not be refreshed')))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-lg sm:text-xl font-extrabold text-text">User Management</h2>
          <p className="text-xs sm:text-xs sm:text-sm text-text-tertiary">Review accounts, verification status and Anveshan progress · {total.toLocaleString()} {total === 1 ? 'user' : 'users'}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            name="users"
            columns={USER_EXPORT_COLUMNS}
            disabled={total === 0}
            fetchPage={(page, limit) => adminApi.getUsers({
              page, limit,
              search: debouncedSearch || undefined,
              status: statusFilter || undefined,
              role: roleFilter || undefined,
              category: categoryFilter || undefined,
              state: stateFilter || undefined,
              anveshan: anveshanFilter || undefined,
              tester: testerFilter || undefined,
              fromDate: usableFrom || undefined,
              toDate: usableTo || undefined,
              excludeId: currentUser?.id,
            })}
          />
          {isSuperAdmin && (
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          )}
        </div>
      </div>

      {/* Counts for the selected join date range */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CountCard index={0} icon={Users} label="Total users" value={stats?.total} />
        <CountCard index={1} icon={FlaskConical} label="Test accounts" value={stats?.testers} />
        <CountCard index={2} icon={Sprout} label="Anveshan users" value={stats?.anveshan} />
        <CountCard index={3} icon={UserRound} label="Non-Anveshan users" value={stats?.nonAnveshan} />
      </div>

      {/* Filters */}
      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <FilterField label="Search" htmlFor="users-search">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                <Input
                  id="users-search"
                  placeholder="Search by name or mobile..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  className="pl-9 !bg-surface-variant dark:!bg-surface-variant"
                />
              </div>
            </FilterField>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="users-filters-panel"
            className="h-10 gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">{activeFilterCount}</span>
            )}
            <ChevronDown className={cn('h-4 w-4 transition-transform', filtersOpen && 'rotate-180')} aria-hidden="true" />
          </Button>
        </div>

        {filtersOpen && (
        <div id="users-filters-panel" className="grid grid-cols-1 gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Status">
            <FilterSelect
              ariaLabel="Filter by status"
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
              options={STATUS_FILTER_OPTIONS.map((chip) => ({ value: chip.value, label: chip.value ? chip.label : 'All statuses' }))}
            />
          </FilterField>
          {isSuperAdmin && anveshanScope !== 'only' && (
            <FilterField label="Role">
              <FilterSelect
                ariaLabel="Filter by role"
                value={roleFilter}
                onChange={(v) => { setRoleFilter(v); setPage(1) }}
                options={ROLE_OPTIONS}
              />
            </FilterField>
          )}
          {anveshanScope !== 'only' && (
            <FilterField label="Category">
              <FilterSelect
                ariaLabel="Filter by category"
                value={categoryFilter}
                onChange={(v) => { setCategoryFilter(v); setPage(1) }}
                options={CATEGORY_OPTIONS}
              />
            </FilterField>
          )}
          <FilterField label="State">
            <FilterSelect
              ariaLabel="Filter by state"
              value={stateFilter}
              onChange={(v) => { setStateFilter(v); setPage(1) }}
              options={[{ value: '', label: 'All States' }, ...states.map((s) => ({ value: s.name, label: s.name }))]}
            />
          </FilterField>
          <FilterField label="Account type">
            <FilterSelect
              ariaLabel="Filter by tester accounts"
              value={testerFilter}
              onChange={(v) => { setTesterFilter(v); setPage(1) }}
              options={[
                { value: '', label: 'All accounts' },
                { value: 'only', label: 'Testers only' },
                { value: 'exclude', label: 'Exclude testers' },
              ]}
            />
          </FilterField>
          {canFilterAnveshan && anveshanScope !== 'exclude' && (
            <FilterField label="Anveshan progress">
              <FilterSelect
                ariaLabel="Filter by Anveshan progress"
                value={anveshanFilter}
                onChange={(v) => { setAnveshanFilter(v as AnveshanFilter); setPage(1) }}
                options={anveshanFilterOptions}
              />
            </FilterField>
          )}
          <FilterField label="Joined from" htmlFor="users-from">
            <Input id="users-from" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => { setFromDate(e.target.value); setPage(1) }} className="!bg-surface-variant dark:!bg-surface-variant" />
          </FilterField>
          <FilterField label="Joined to" htmlFor="users-to">
            <Input id="users-to" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => { setToDate(e.target.value); setPage(1) }} className="!bg-surface-variant dark:!bg-surface-variant" aria-invalid={dateRangeInvalid} />
            {dateRangeInvalid && <p role="alert" className="text-xs text-red-600">To date must be on or after the From date.</p>}
          </FilterField>
        </div>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-variant/50">
                <SortableHeader label="User" sortKey="name" activeKey={sortBy} order={sortOrder} onSort={handleSort} />
                <SortableHeader label="Role" sortKey="role" activeKey={sortBy} order={sortOrder} onSort={handleSort} />
                <SortableHeader label="Status" sortKey="verificationStatus" activeKey={sortBy} order={sortOrder} onSort={handleSort} />
                <SortableHeader label="Location" sortKey="state" activeKey={sortBy} order={sortOrder} onSort={handleSort} />
                <SortableHeader newBadge label="Anveshan Progress" sortKey="anveshanProgress" activeKey={sortBy} order={sortOrder} onSort={handleSort} />
                <SortableHeader label="Joined" sortKey="createdAt" activeKey={sortBy} order={sortOrder} onSort={handleSort} />
                <SortableHeader label="Last Login" sortKey="lastLoginAt" activeKey={sortBy} order={sortOrder} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-surface-variant animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-text-secondary">No users found</td>
                </tr>
              ) : (
                users.map((u) => {
                  const StatusIcon = STATUS_ICONS[u.verificationStatus] ?? Clock
                  const isLocked = u.verificationStatus === 'suspended' || u.verificationStatus === 'banned'
                  return (
                    <tr
                      key={u.id}
                      className={cn(
                        'hover:bg-surface-variant/30 transition-colors',
                        isLocked && 'bg-red-50 dark:bg-red-950/20',
                      )}
                    >
                      <td className="px-4 py-3">
                        <Link to={u.isAnveshanUser ? `/users/${u.id}/anveshan` : `/users/${u.id}`} className="flex items-center gap-3 group">
                          <div className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] sm:text-[11px] sm:text-xs font-bold',
                            isLocked ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' : 'bg-primary/10 text-primary',
                          )}>
                            {(u.name || u.username || u.mobileNumber).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className={cn('font-semibold group-hover:text-primary transition-colors', isLocked && 'text-red-700 dark:text-red-400')}>
                                {u.name || '—'}
                              </p>
                              {u.isTester && <TesterTag />}
                              {isLocked && (
                                <span className={cn(
                                  'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                                  u.verificationStatus === 'banned'
                                    ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300'
                                    : 'bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
                                )}>
                                  {u.verificationStatus === 'banned' ? 'BANNED' : 'SUSPENDED'}
                                </span>
                              )}
                            </div>
                            {u.username && <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">@{u.username}</p>}
                            <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">{u.mobileNumber}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={u.role === 'super_admin' ? 'destructive' : u.role === 'admin' ? 'default' : 'secondary'}
                          className="capitalize text-[11px] sm:text-[11px] sm:text-xs"
                        >
                          {u.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={cn('h-3.5 w-3.5', STATUS_COLORS[u.verificationStatus] ? 'text-text' : 'text-text-tertiary')} />
                          <span className={cn('rounded-full px-2 py-0.5 text-[11px] sm:text-[11px] sm:text-xs font-semibold capitalize', STATUS_COLORS[u.verificationStatus] ?? 'bg-surface-variant text-text-secondary')}>
                            {u.verificationStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {[u.district, u.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {u.anveshanProgress ? (
                          <AnveshanProgressCell progress={u.anveshanProgress} />
                        ) : (
                          <span className="text-text-tertiary" aria-label="Not an Anveshan user">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {formatDate(u.createdAt) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3">
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs sm:text-xs sm:text-sm text-text-secondary">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <AddUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleUserCreated} />
    </div>
  )
}