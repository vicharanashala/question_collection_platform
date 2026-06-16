import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import {
  Search, ChevronLeft, ChevronRight, ShieldCheck,
  PauseCircle, Ban, Clock, CheckCircle, User,
} from 'lucide-react'
import { toast } from 'sonner'
import type { User as UserType } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  verified: 'bg-success text-white',
  pending: 'bg-warning text-white',
  suspended: 'bg-warning text-white',
  banned: 'bg-destructive text-white',
  manual_review: 'bg-[hsl(263,70%,50%)] text-white',
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  verified: CheckCircle,
  pending: Clock,
  suspended: PauseCircle,
  banned: Ban,
}

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

  useEffect(() => {
    setLoading(true)
    adminApi.getUsers({ page, limit, search: search || undefined, status: statusFilter || undefined, role: roleFilter || undefined })
      .then((res) => { setUsers(res.items); setTotal(res.total) })
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load users')))
      .finally(() => setLoading(false))
  }, [page, search, statusFilter, roleFilter])

  const totalPages = Math.ceil(total / limit)
  const isSuperAdmin = currentUser?.role === 'super_admin'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total users</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or mobile..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background dark:bg-card px-3 text-sm text-foreground"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          {isSuperAdmin && (
            <select
              className="h-10 rounded-md border border-input bg-background dark:bg-card px-3 text-sm text-foreground"
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="curator">Curator</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Location</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">No users found</td>
                </tr>
              ) : (
                users.map((u) => {
                  const StatusIcon = STATUS_ICONS[u.verificationStatus] ?? Clock
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/users/${u.id}`} className="flex items-center gap-3 group">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {(u.name || u.mobileNumber).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                              {u.name || '—'}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.mobileNumber}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.role === 'super_admin' ? 'destructive' : u.role === 'admin' ? 'default' : 'secondary'} className="capitalize text-xs">
                          {u.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={cn('h-3.5 w-3.5', STATUS_COLORS[u.verificationStatus] ? 'text-foreground' : 'text-muted-foreground')} />
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', STATUS_COLORS[u.verificationStatus] ?? 'bg-muted text-muted-foreground')}>
                            {u.verificationStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {[u.district, u.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(u.createdAt) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}
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
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
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
              <span className="text-sm text-muted-foreground">
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
    </div>
  )
}