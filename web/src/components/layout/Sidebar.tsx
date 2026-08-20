import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  ScrollText,
  Flag,
  HelpCircle,
  Send,
} from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { SignOutDialog } from '@/components/SignOutDialog'

// Nav items use a translation key (`labelKey`) instead of a literal so the
// sidebar re-renders in the active language via i18next's `t()`.
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

export function Sidebar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  // Role label is a translation key so each role renders in the active
  // language. Falls back to the raw role string for unknown roles.
  const roleKey = user?.role ? `roles.${user.role}` : null
  const roleLabel = roleKey ? t(roleKey) : ''

  return (
    <aside className="flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 items-center justify-center">
          <BrandLogo className="h-8 w-8" />
        </div>
        <div className="ml-3">
          <p className="text-xs sm:text-xs sm:text-sm font-bold text-sidebar-foreground">{t('app.staffPortal')}</p>
          {roleLabel && (
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-sidebar-foreground/60 capitalize">{roleLabel}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ to, labelKey, icon: Icon, roles }) => {
          if (!roles?.includes(user?.role as string)) return null
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-xs sm:text-xs sm:text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(labelKey)}
            </NavLink>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-sidebar-border p-3">
        <div className="mb-2 flex items-center gap-2 rounded-md px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] sm:text-[11px] sm:text-xs font-bold text-primary-foreground">
            {(user?.name || user?.mobileNumber || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] sm:text-[11px] sm:text-xs font-semibold text-sidebar-foreground">{user?.name || t('roles.admin')}</p>
            <p className="truncate text-[11px] sm:text-[11px] sm:text-xs text-sidebar-foreground/80">{user?.mobileNumber}</p>
          </div>
        </div>
        <button
          onClick={() => setLogoutConfirmOpen(true)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs sm:text-xs sm:text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {t('profile.signOut')}
        </button>
      </div>

      <SignOutDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen} />
    </aside>
  )
}