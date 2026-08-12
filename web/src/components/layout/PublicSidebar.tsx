import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import {
  Home,
  MessageSquarePlus,
  ListChecks,
  HelpCircle,
  User,
  Wallet,
  LogOut,
  Sprout,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/public',           label: 'Home',          icon: Home,             end: true },
  { to: '/public/ask',       label: 'Ask Question',  icon: MessageSquarePlus },
  { to: '/public/questions', label: 'My Questions',  icon: ListChecks },
  { to: '/public/faqs',      label: 'Help & FAQ',    icon: HelpCircle },
  { to: '/public/wallet',    label: 'Wallet',        icon: Wallet },
  { to: '/public/profile',   label: 'Profile',       icon: User },
]

export function PublicSidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  return (
    <aside className="flex h-full w-56 flex-col border-r border-emerald-100 bg-white dark:border-emerald-900/40 dark:bg-surface">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-emerald-100 px-4 dark:border-emerald-900/40">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm">
          <Sprout className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">AnnaDatha</p>
          <p className="text-[11px] text-text-tertiary leading-tight">Public Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-text-secondary hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-emerald-100 p-3 dark:border-emerald-900/40">
        <div className="mb-2 flex items-center gap-2 rounded-md bg-emerald-50/60 px-3 py-2 dark:bg-emerald-950/30">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
            {(user?.name || user?.mobileNumber || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{user?.name || 'Welcome'}</p>
            <p className="truncate text-[11px] text-text-tertiary">{user?.mobileNumber}</p>
          </div>
        </div>
        <button
          onClick={() => setLogoutConfirmOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-secondary hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 transition-colors"
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
              Are you sure you want to sign out of your AnnaDatha account?
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
