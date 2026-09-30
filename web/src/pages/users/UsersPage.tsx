import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, lgdApi, getErrorMessage, type LgdState } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import {
  Search, ChevronLeft, ChevronRight, Plus,
  PauseCircle, Ban, Clock, CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { User as UserType } from '@/types'
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
        className={cn('shrink-0 !bg-surface-variant dark:!bg-surface-variant [&>span]:truncate', className)}
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

const STATUS_FILTER_CHIPS: { value: string; label: string; dot: string }[] = [
  { value: '',               label: 'All',     dot: 'bg-muted' },
  { value: 'verified',      label: 'Verified', dot: 'bg-emerald-500' },
  { value: 'pending',       label: 'Pending',  dot: 'bg-amber-500' },
  { value: 'suspended',     label: 'Suspended',dot: 'bg-amber-500' },
  { value: 'banned',        label: 'Banned',   dot: 'bg-red-600' },
]

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserType[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [states, setStates] = useState<LgdState[]>([])
  const [anveshanFilter, setAnveshanFilter] = useState<AnveshanFilter>('')
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

  useEffect(() => {
  setLoading(true)
  adminApi.getUsers({
    page, limit,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    role: roleFilter || undefined,
    category: categoryFilter || undefined,   // ← add this
    state: stateFilter || undefined,
    anveshan: anveshanFilter || undefined,
    excludeId: currentUser?.id,
  })
    .then((res) => { setUsers(res.items); setTotal(res.total) })
    .catch((e) => toast.error(getErrorMessage(e, 'Failed to load users')))
    .finally(() => setLoading(false))
}, [page, debouncedSearch, statusFilter, roleFilter, categoryFilter, stateFilter, anveshanFilter, currentUser?.id])

  const totalPages = Math.ceil(total / limit)
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const canFilterAnveshan = isSuperAdmin || currentUser?.role === 'admin'

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
          <h2 className="text-lg sm:text-lg sm:text-xl font-extrabold text-text">Users</h2>
          <p className="text-xs sm:text-xs sm:text-sm text-text-tertiary">{total.toLocaleString()} total users</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              placeholder="Search by name or mobile..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9 !bg-surface-variant dark:!bg-surface-variant"
            />
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {STATUS_FILTER_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => { setStatusFilter(chip.value); setPage(1) }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] sm:text-[11px] sm:text-xs font-semibold transition-all border',
                  statusFilter === chip.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border-subtle bg-surface-variant text-text-secondary hover:border-primary/40 hover:text-text',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', chip.dot)} />
                {chip.label}
              </button>
            ))}
          </div>
          {isSuperAdmin && (
            <FilterSelect
              ariaLabel="Filter by role"
              value={roleFilter}
              onChange={(v) => { setRoleFilter(v); setPage(1) }}
              options={ROLE_OPTIONS}
              className="w-[calc(50%-0.375rem)] sm:w-40"
            />
          )}
          <FilterSelect
            ariaLabel="Filter by category"
            value={categoryFilter}
            onChange={(v) => { setCategoryFilter(v); setPage(1) }}
            options={CATEGORY_OPTIONS}
            className="w-[calc(50%-0.375rem)] sm:w-44"
          />
          <FilterSelect
            ariaLabel="Filter by state"
            value={stateFilter}
            onChange={(v) => { setStateFilter(v); setPage(1) }}
            options={[{ value: '', label: 'All States' }, ...states.map((s) => ({ value: s.name, label: s.name }))]}
            className="w-[calc(50%-0.375rem)] sm:w-44"
          />
          {canFilterAnveshan && (
            <FilterSelect
              ariaLabel="Filter by Anveshan progress"
              value={anveshanFilter}
              onChange={(v) => { setAnveshanFilter(v as AnveshanFilter); setPage(1) }}
              options={ANVESHAN_FILTER_OPTIONS}
              className="w-[calc(50%-0.375rem)] sm:w-56"
            />
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-variant/50">
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">User</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Location</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Anveshan Progress</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Joined</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Last Login</th>
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
                        <Link to={`/users/${u.id}`} className="flex items-center gap-3 group">
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