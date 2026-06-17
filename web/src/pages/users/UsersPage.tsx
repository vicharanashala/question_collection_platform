import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import {
  Search, ChevronLeft, ChevronRight, ShieldCheck, Plus,
  PauseCircle, Ban, Clock, CheckCircle, User,
} from 'lucide-react'
import { toast } from 'sonner'
import type { User as UserType } from '@/types'

const STATUS_COLORS: Record<string, string> = {
  verified: 'bg-success text-white',
  pending: 'bg-warning text-white',
  suspended: 'bg-warning text-white',
  banned: 'bg-destructive text-white',
  manual_review: 'bg-ai_review text-white',
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

  // ── Create user dialog state ─────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    mobileNumber: '',
    role: 'user',
    category: 'farmer',
    state: '',
    district: '',
    block: '',
  })
  const [formError, setFormError] = useState('')

  function openCreate() {
    setForm({ name: '', mobileNumber: '', role: 'user', category: 'farmer', state: '', district: '', block: '' })
    setFormError('')
    setCreateOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.mobileNumber.trim() || !form.state.trim() || !form.district.trim()) {
      setFormError('Name, mobile number, state, and district are required.')
      return
    }
    setCreating(true)
    setFormError('')
    try {
      await adminApi.createUser({
        name: form.name.trim(),
        mobileNumber: form.mobileNumber.trim(),
        role: form.role,
        category: form.role === 'user' ? form.category : undefined,
        state: form.state.trim(),
        district: form.district.trim(),
        block: form.block.trim() || undefined,
      })
      toast.success('User created successfully')
      setCreateOpen(false)
      setPage(1)
      adminApi.getUsers({ page: 1, limit, search: debouncedSearch || undefined, status: statusFilter || undefined, role: roleFilter || undefined, excludeId: currentUser?.id })
        .then((res) => { setUsers(res.items); setTotal(res.total) })
        .catch(() => { /* error handled elsewhere */ })
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to create user'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-text">Users</h2>
          <p className="text-sm text-text-tertiary">{total.toLocaleString()} total users</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openCreate} size="sm">
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
          <select
            className="h-10 rounded-md border border-border-subtle bg-surface-variant px-3 text-sm text-text !bg-surface-variant dark:!bg-surface-variant"
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
              className="h-10 rounded-md border border-border-subtle bg-surface-variant px-3 text-sm text-text !bg-surface-variant dark:!bg-surface-variant"
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
                  return (
                    <tr key={u.id} className="hover:bg-surface-variant/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/users/${u.id}`} className="flex items-center gap-3 group">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {(u.name || u.mobileNumber).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-text group-hover:text-primary transition-colors">
                              {u.name || '—'}
                            </p>
                            <p className="text-xs text-text-tertiary">{u.mobileNumber}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={u.role === 'super_admin' ? 'destructive' : u.role === 'admin' ? 'default' : 'secondary'}
                          className="capitalize text-xs"
                        >
                          {u.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={cn('h-3.5 w-3.5', STATUS_COLORS[u.verificationStatus] ? 'text-text' : 'text-text-tertiary')} />
                          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold capitalize', STATUS_COLORS[u.verificationStatus] ?? 'bg-surface-variant text-text-secondary')}>
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
            <p className="text-xs text-text-secondary">
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
              <span className="text-sm text-text-secondary">
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

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label htmlFor="cu-name">Full Name</Label>
                <Input
                  id="cu-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ramesh Kumar"
                  required
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="cu-mobile">Mobile Number</Label>
                <Input
                  id="cu-mobile"
                  type="tel"
                  value={form.mobileNumber}
                  onChange={(e) => setForm((f) => ({ ...f, mobileNumber: e.target.value }))}
                  placeholder="9876543210"
                  maxLength={10}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cu-role">Role</Label>
                <select
                  id="cu-role"
                  className="mt-1 flex h-10 w-full rounded-md border border-border-subtle bg-surface-variant px-3 py-2 text-sm text-text !bg-surface-variant dark:!bg-surface-variant"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <option value="user">User</option>
                  <option value="curator">Curator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {form.role === 'user' && (
                <div>
                  <Label htmlFor="cu-category">Category</Label>
                  <select
                    id="cu-category"
                    className="mt-1 flex h-10 w-full rounded-md border border-border-subtle bg-surface-variant px-3 py-2 text-sm text-text !bg-surface-variant dark:!bg-surface-variant"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    <option value="farmer">Farmer</option>
                    <option value="fpo">FPO</option>
                    <option value="student">Student</option>
                    <option value="volunteer">Volunteer</option>
                    <option value="ngo">NGO</option>
                  </select>
                </div>
              )}
              <div>
                <Label htmlFor="cu-state">State</Label>
                <Input
                  id="cu-state"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  placeholder="Maharashtra"
                  required
                />
              </div>
              <div>
                <Label htmlFor="cu-district">District</Label>
                <Input
                  id="cu-district"
                  value={form.district}
                  onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
                  placeholder="Pune"
                  required
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="cu-block">Block <span className="text-text-tertiary font-normal">(optional)</span></Label>
                <Input
                  id="cu-block"
                  value={form.block}
                  onChange={(e) => setForm((f) => ({ ...f, block: e.target.value }))}
                  placeholder="Haveli"
                />
              </div>
            </div>

            {formError && <p className="text-sm text-destructive">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}