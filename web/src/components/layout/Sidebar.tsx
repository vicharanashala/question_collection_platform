import { NewBadge } from '@/components/ui/new-badge'
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
  Sprout,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { SignOutDialog } from '@/components/SignOutDialog'

// Nav items use a translation key (`labelKey`) instead of a literal so the
// sidebar re-renders in the active language via i18next's `t()`.
const navItems = [
  { to: '/dashboard',      labelKey: 'nav.dashboard',      icon: LayoutDashboard, roles: ['user', 'curator', 'finance', 'distributor', 'admin', 'super_admin'] },
  { to: '/users',          labelKey: 'nav.userManagement', icon: Users,           roles: ['finance', 'admin', 'super_admin'] },
  { to: '/questions',      labelKey: 'nav.questions',      icon: MessageSquare,   roles: ['user', 'curator', 'admin', 'super_admin'] },
  { to: '/agri-entities',  labelKey: 'nav.agriEntities',   icon: Sprout,          roles: ['curator', 'admin', 'super_admin'], defaultLabel: 'Agri Entities' },
  { to: '/reviews',        labelKey: 'nav.reviewQueue',    icon: CheckSquare,     roles: ['curator', 'super_admin'] },
  { to: '/feedbacks',      labelKey: 'nav.feedbacks',      icon: Star,            roles: ['admin', 'super_admin'], defaultLabel: 'App Feedback' },
  { to: '/distributions',  labelKey: 'nav.distributions',  icon: Send,            roles: ['distributor', 'admin', 'super_admin'] },
  { to: '/withdrawals',    labelKey: 'nav.withdrawals',    icon: CreditCard,      roles: ['finance', 'admin', 'super_admin'] },
  { to: '/wallets',        labelKey: 'nav.wallets',        icon: Wallet,          roles: ['finance', 'admin', 'super_admin'] },
  { to: '/settings',       labelKey: 'nav.settings',       icon: Settings2,       roles: ['super_admin'] },
  { to: '/audit-logs',     labelKey: 'nav.auditLogs',      icon: ScrollText,      roles: ['super_admin', 'admin', 'finance', 'curator', 'distributor'] },
  { to: '/reports',        labelKey: 'nav.reports',        icon: Flag,            roles: ['admin', 'super_admin', 'curator'] },
  { to: '/admin/faqs',     labelKey: 'nav.faqManagement',  icon: HelpCircle,      roles: ['admin', 'super_admin'], newFeature: 'faqAdmin' as const },
]

const COLLAPSED_KEY = 'staff-sidebar-collapsed'

// Reads the saved collapsed state, treating blocked storage as expanded.
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function Sidebar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)

  // Flips the collapsed state and remembers it for the next visit.
  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
    } catch {
      // Storage can be unavailable; the choice then lasts until the page reloads.
    }
  }

  // Role label is a translation key so each role renders in the active
  // language. Falls back to the raw role string for unknown roles.
  const roleKey = user?.role ? `roles.${user.role}` : null
  const roleLabel = roleKey ? t(roleKey) : ''

  return (
    <aside className={cn('flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200', collapsed ? 'w-16' : 'w-56')}>
      {/* Logo / Brand */}
      <div className={cn('flex h-14 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'px-4')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
          <BrandLogo className="h-8 w-8" />
        </div>
        <div className={cn('ml-3 min-w-0', collapsed && 'hidden')}>
          <p className="text-xs sm:text-xs sm:text-sm font-bold text-sidebar-foreground">{t('app.staffPortal')}</p>
          {roleLabel && (
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-sidebar-foreground/60 capitalize">{roleLabel}</p>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 space-y-1 overflow-y-auto', collapsed ? 'p-2' : 'p-3')}>
        {navItems.map(({ to, labelKey, icon: Icon, roles, defaultLabel, newFeature }) => {
          if (!roles?.includes(user?.role as string)) return null
          const label = t(labelKey, { defaultValue: defaultLabel })
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-xs sm:text-xs sm:text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
              {!collapsed && newFeature && <NewBadge feature={newFeature} className="ml-auto" />}
            </NavLink>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className={cn('border-t border-sidebar-border', collapsed ? 'p-2' : 'p-3')}>
        <div className={cn('mb-2 flex items-center gap-2 rounded-md px-3 py-2', collapsed && 'justify-center px-0')} title={collapsed ? user?.name || user?.mobileNumber : undefined}>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] sm:text-[11px] sm:text-xs font-bold text-primary-foreground">
            {(user?.name || user?.mobileNumber || '?').slice(0, 2).toUpperCase()}
          </div>
          <div className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
            <p className="truncate text-[11px] sm:text-[11px] sm:text-xs font-semibold text-sidebar-foreground">{user?.name || t('roles.admin')}</p>
            <p className="truncate text-[11px] sm:text-[11px] sm:text-xs text-sidebar-foreground/80">{user?.mobileNumber}</p>
          </div>
        </div>
        <button
          onClick={() => setLogoutConfirmOpen(true)}
          title={collapsed ? t('profile.signOut') : undefined}
          aria-label={collapsed ? t('profile.signOut') : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs sm:text-xs sm:text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && t('profile.signOut')}
        </button>
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : undefined}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs sm:text-xs sm:text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelLeftClose className="h-4 w-4 shrink-0" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>

      <SignOutDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen} />
    </aside>
  )
}