import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CheckSquare,
  Settings2,
  CreditCard,
  LogOut,
  Wallet,
  ScrollText,
  Flag,
  HelpCircle,
  Send,
  Languages,
  X,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SignOutDialog } from '@/components/SignOutDialog'
import { BrandLogo } from '@/components/BrandLogo'

// Mirror of `Sidebar.tsx` navItems — kept in sync so the mobile drawer
// shows exactly what the desktop sidebar would for the active role.
const navItems = [
  { to: '/dashboard',      labelKey: 'nav.dashboard',      icon: LayoutDashboard, roles: ['user', 'curator', 'finance', 'distributor', 'admin', 'super_admin'] },
  { to: '/users',          labelKey: 'nav.userManagement', icon: Users,           roles: ['finance', 'admin', 'super_admin'] },
  { to: '/questions',      labelKey: 'nav.questions',      icon: MessageSquare,   roles: ['user', 'curator', 'admin', 'super_admin'] },
  { to: '/reviews',        labelKey: 'nav.reviewQueue',    icon: CheckSquare,     roles: ['curator', 'super_admin'] },
  { to: '/distributions',  labelKey: 'nav.distributions',  icon: Send,            roles: ['distributor', 'admin', 'super_admin'] },
  { to: '/withdrawals',    labelKey: 'nav.withdrawals',    icon: CreditCard,      roles: ['finance', 'admin', 'super_admin'] },
  { to: '/wallets',        labelKey: 'nav.wallets',        icon: Wallet,          roles: ['finance', 'admin', 'super_admin'] },
  { to: '/settings',       labelKey: 'nav.settings',       icon: Settings2,       roles: ['super_admin'] },
  { to: '/audit-logs',     labelKey: 'nav.auditLogs',      icon: ScrollText,      roles: ['super_admin', 'admin'] },
  { to: '/reports',        labelKey: 'nav.reports',        icon: Flag,            roles: ['admin', 'super_admin', 'curator'] },
  { to: '/admin/faqs',     labelKey: 'nav.faqManagement',  icon: HelpCircle,      roles: ['admin', 'super_admin'] },
]

interface MobileNavProps {
  open: boolean
  onClose: () => void
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const { user } = useAuth()
  const { t } = useTranslation()
  const { nativeName } = useLanguage()
  const { pathname } = useLocation()
  const [languageOpen, setLanguageOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  // Role label translates to the active language.
  const roleKey = user?.role ? `roles.${user.role}` : null
  const roleLabel = roleKey ? t(roleKey) : ''

  // Close on route change so the user sees the freshly-navigated content.
  useEffect(() => {
    if (open) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

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
            <div className="flex h-8 w-8 items-center justify-center">
              <BrandLogo className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs sm:text-xs sm:text-sm font-bold text-sidebar-foreground">{t('app.staffPortal')}</p>
              {roleLabel && (
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-sidebar-foreground/60 capitalize">{roleLabel}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-sidebar-foreground">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map(({ to, labelKey, icon: Icon, roles }) => {
            if (!roles?.includes(user?.role as string)) return null
            return (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-xs sm:text-xs sm:text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {t(labelKey)}
              </NavLink>
            )
          })}
        </nav>

        {/* User info + logout */}
        <div className="border-t border-sidebar-border p-3 shrink-0">
          <div className="mb-2 flex items-center gap-2 rounded-md px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-[11px] sm:text-[11px] sm:text-xs font-bold text-sidebar-primary-foreground">
              {(user?.name || user?.mobileNumber || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] sm:text-[11px] sm:text-xs font-semibold text-sidebar-foreground">{user?.name || t('roles.admin')}</p>
              <p className="truncate text-[11px] sm:text-[11px] sm:text-xs text-sidebar-foreground/80">{user?.mobileNumber}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setLanguageOpen(true)}
            className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Languages className="h-4 w-4" />
            <span className="flex-1 text-left">{t('auth.selectLanguage')}</span>
            <span className="text-[11px] sm:text-[11px] sm:text-xs text-sidebar-foreground/60">{nativeName}</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => { setLogoutConfirmOpen(true); onClose() }}
            className="w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            {t('profile.signOut')}
          </Button>
        </div>
      </DialogContent>
      <LanguageSwitcher open={languageOpen} onClose={() => setLanguageOpen(false)} />
      <SignOutDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen} />
    </Dialog>
  )
}