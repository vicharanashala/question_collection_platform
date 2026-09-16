import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import {
  Search, ChevronLeft, ChevronRight, Plus,
  PauseCircle, Ban, Clock, CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { User as UserType } from '@/types'
import { AddUserDialog } from './AddUserDialog'

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
  const [loading, setLoading] = useState(false)
  const limit = 20
  const debouncedSearch = useDebouncedValue(search, 400)

  useEffect(() => {
    setLoading(true)
    adminApi.getUsers({ page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined, role: roleFilter || undefined, excludeId: currentUser?.id })
      .then((res) => { setUsers(res.items); setTotal(res.total) })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load users')))
      .finally(() => setLoading(false))
  }, [page, debouncedSearch, statusFilter, roleFilter, currentUser?.id])

  const totalPages = Math.ceil(total / limit)
  const isSuperAdmin = currentUser?.role === 'super_admin'

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
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              placeholder="Search by name or mobile..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9 !bg-surface-variant dark:!bg-surface-variant"
            />
          </div>
          <div className="flex flex-wrap gap-2">
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
            <select
              className="h-10 rounded-md border border-border-subtle bg-surface-variant px-3 text-xs sm:text-xs sm:text-sm text-text !bg-surface-variant dark:!bg-surface-variant"
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="curator">Curator</option>
              <option value="finance">Finance</option>
              <option value="distributor">Distributor</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
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
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Joined</th>
                <th className="px-4 py-3 text-left font-semibold text-text-secondary">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-surface-variant animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-secondary">No users found</td>
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