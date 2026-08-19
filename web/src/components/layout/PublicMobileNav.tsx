import { X, Home, MessageSquarePlus, ListChecks, Wallet, User, LogOut } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface PublicMobileNavProps {
  open: boolean
  onClose: () => void
}

const items = [
  { to: '/home',           labelKey: 'nav.home',        icon: Home,             end: true },
  { to: '/home/ask',       labelKey: 'nav.submit',      icon: MessageSquarePlus },
  { to: '/home/questions', labelKey: 'nav.submissions', icon: ListChecks },
  { to: '/home/wallet',    labelKey: 'nav.wallet',      icon: Wallet },
  { to: '/home/profile',   labelKey: 'nav.profile',     icon: User },
]

export function PublicMobileNav({ open, onClose }: PublicMobileNavProps) {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [logoutOpen, setLogoutOpen] = useState(false)

  function handleSignOut() {
    setLogoutOpen(false)
    onClose()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {/* Slide-in drawer (left side) */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={onClose}
        />

        {/* Drawer */}
        <div
          className={`absolute left-0 top-0 h-full w-72 bg-white shadow-xl transition-transform dark:bg-surface ${open ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex h-14 items-center justify-between border-b border-border-subtle px-4 dark:border-border-subtle">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center">
                <BrandLogo className="h-9 w-9" />
              </div>
              <div>
                <p className="text-xs sm:text-xs sm:text-sm font-bold text-foreground leading-tight">AnnaDatha</p>
                <p className="text-[11px] text-text-tertiary leading-tight">{t('app.publicPortal')}</p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-text-secondary hover:bg-accent">
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {items.map(({ to, labelKey, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-xs sm:text-xs sm:text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-text-secondary hover:bg-surface-variant hover:text-foreground'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 border-t border-border-subtle p-3 dark:border-border-subtle">
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
              onClick={() => setLogoutOpen(true)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs sm:text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t('profile.signOut')}
            </button>
          </div>
        </div>
      </div>

      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.signOut')}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>{t('profile.signOutCancel')}</Button>
            <Button variant="destructive" onClick={handleSignOut}>{t('profile.signOutAction')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  )
}