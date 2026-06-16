import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CheckSquare,
  LogOut,
  X,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/questions', label: 'Questions', icon: MessageSquare },
  { to: '/reviews', label: 'Review Queue', icon: CheckSquare, roles: ['curator', 'admin', 'super_admin'] },
]

interface MobileNavProps {
  open: boolean
  onClose: () => void
  onLogout: () => void
}

export function MobileNav({ open, onClose, onLogout }: MobileNavProps) {
  const { user } = useAuth()

  // Close on route change
  useEffect(() => {
    if (open) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  // Trap scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="left-4 right-4 top-4 bottom-4 w-auto max-w-none p-0 flex flex-col translate-x-0 translate-y-0 rounded-xl max-h-[calc(100vh-2rem)]">
        {/* Drawer header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <span className="text-sm font-black text-sidebar-primary-foreground">QP</span>
            </div>
            <div>
              <p className="text-sm font-bold text-sidebar-foreground">QuestionPlatform</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-sidebar-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon, roles }) => {
            if (roles && !roles.includes(user?.role as string)) return null
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </NavLink>
            )
          })}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-sidebar-border p-3 shrink-0">
          <div className="mb-2 flex items-center gap-2 rounded-md px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {(user?.name || user?.mobileNumber || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">{user?.name || 'Admin'}</p>
              <p className="truncate text-xs text-sidebar-foreground/80">{user?.mobileNumber}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => { onLogout(); onClose() }}
            className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}