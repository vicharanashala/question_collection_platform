import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import {
  Home,
  MessageSquarePlus,
  ListChecks,
  User,
  Wallet,
  LogOut,
} from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const navItems = [
  { to: '/home',           labelKey: 'nav.home',        icon: Home,             end: true },
  { to: '/home/ask',       labelKey: 'nav.submit',      icon: MessageSquarePlus },
  { to: '/home/questions', labelKey: 'nav.submissions', icon: ListChecks },
  { to: '/home/wallet',    labelKey: 'nav.wallet',      icon: Wallet },
  { to: '/home/profile',   labelKey: 'nav.profile',     icon: User },
]

export function PublicSidebar() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border-subtle bg-white dark:border-border-subtle dark:bg-surface">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border-subtle px-4 dark:border-border-subtle">
        <div className="flex h-9 w-9 items-center justify-center">
          <BrandLogo className="h-9 w-9" />
        </div>
        <div>
          <p className="text-xs sm:text-xs sm:text-sm font-bold text-foreground leading-tight">AnnaDatha</p>
          <p className="text-[11px] text-text-tertiary leading-tight">Public Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ to, labelKey, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-xs sm:text-xs sm:text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-text-secondary hover:bg-surface-variant hover:text-foreground',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-border-subtle p-3 dark:border-border-subtle">
        <div className="mb-2 flex items-center gap-2 rounded-md bg-surface-variant px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] sm:text-[11px] sm:text-xs font-bold text-primary-foreground">
            {(user?.name || user?.mobileNumber || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] sm:text-[11px] sm:text-xs font-semibold text-foreground">{user?.name || 'Welcome'}</p>
            <p className="truncate text-[11px] text-text-tertiary">{user?.mobileNumber}</p>
          </div>
        </div>
        <button
          onClick={() => setLogoutConfirmOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs sm:text-xs sm:text-sm font-medium text-text-secondary hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t('profile.signOut')}
        </button>
      </div>

      {/* Logout confirmation */}
      <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.signOut')}</DialogTitle>
            <DialogDescription>
              {t('profile.signOutConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)}>
              {t('profile.signOutCancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLogoutConfirmOpen(false)
                logout()
                navigate('/login', { replace: true })
              }}
            >
              {t('profile.signOutAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
