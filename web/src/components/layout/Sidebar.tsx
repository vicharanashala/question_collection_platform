import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CheckSquare,
  Settings2,
  CreditCard,
  LogOut,
  Wallet,
  Bell,
  ScrollText,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard, roles: ['user', 'curator', 'admin', 'super_admin'] },
  { to: '/users',     label: 'Users',        icon: Users,        roles: ['admin', 'super_admin'] },
  { to: '/questions', label: 'Questions',     icon: MessageSquare, roles: ['user', 'curator', 'admin', 'super_admin'] },
  { to: '/reviews',   label: 'Review Queue',  icon: CheckSquare,   roles: ['curator', 'super_admin'] },
  { to: '/withdrawals', label: 'Withdrawals',  icon: CreditCard,   roles: ['admin', 'super_admin'] },
  { to: '/wallets',   label: 'Wallets',       icon: Wallet,        roles: ['admin', 'super_admin'] },
  { to: '/notifications', label: 'Notifications', icon: Bell,          roles: ['user', 'curator'] },
  { to: '/settings',  label: 'Settings',      icon: Settings2,    roles: ['super_admin'] },
  { to: '/audit-logs', label: 'Audit Logs',    icon: ScrollText,   roles: ['super_admin'] },
]

export function Sidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  return (
    <aside className="flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <span className="text-sm font-black text-sidebar-primary-foreground">QP</span>
        </div>
        <div className="ml-3">
          <p className="text-sm font-bold text-sidebar-foreground">QuestionPlatform</p>
          <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role?.replace('_', ' ')}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ to, label, icon: Icon, roles }) => {
          if (!roles?.includes(user?.role as string)) return null
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-2 rounded-md px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
            {(user?.name || user?.mobileNumber || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-sidebar-foreground">{user?.name || 'Admin'}</p>
            <p className="truncate text-xs text-sidebar-foreground/80">{user?.mobileNumber}</p>
          </div>
        </div>
        <button
          onClick={() => setLogoutConfirmOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </button>
      </div>

      {/* Logout confirmation */}
      <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Out?</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLogoutConfirmOpen(false)
                logout()
                navigate('/login', { replace: true })
              }}
            >
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}