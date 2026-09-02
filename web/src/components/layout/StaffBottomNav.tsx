import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  ScrollText,
  Menu,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  /**
   * When true, the tab is shown as a centred "primary" action (raised
   * circular button). Mirrors the `PublicBottomNav` style.
   */
  primary?: boolean
  /**
   * When set, the tab is only rendered for users whose role is in this list.
   * If omitted, the tab is visible to every authenticated staff user.
   */
  roles?: string[]
  /**
   * When set to `openMenu`, clicking the tab invokes the `onOpenMenu`
   * callback instead of navigating. Used to surface the full `MobileNav`
   * drawer so the user can reach admin-only routes that don't fit on the
   * bottom tab bar.
   */
  onClick?: 'openMenu'
}

const tabs: Tab[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/questions', label: 'Questions', icon: MessageSquare, roles: ['user', 'curator', 'admin', 'super_admin'] },
  { to: '/reviews',   label: 'Reviews',   icon: CheckSquare,    roles: ['curator', 'super_admin'] },
  { to: '/reports',   label: 'Reports',   icon: ScrollText,     roles: ['admin', 'super_admin', 'curator'] },
  { to: '__menu__',   label: 'More',      icon: Menu,           primary: true, onClick: 'openMenu' },
]

interface StaffBottomNavProps {
  /**
   * Open the full `MobileNav` drawer. Wired up by `AppLayout`; the "More"
   * tab calls this handler so users can reach every nav item.
   */
  onOpenMenu: () => void
}

/**
 * Mobile bottom tab bar for the staff app. Mirrors the public app's
 * `PublicBottomNav` UX so small-viewport users always have one-tap access
 * to the most common destinations (Dashboard, Questions, Reviews, Reports),
 * with a "More" tab that opens the hamburger drawer for the rest.
 *
 * Hidden on `md` and above where the desktop sidebar takes over.
 */
export function StaffBottomNav({ onOpenMenu }: StaffBottomNavProps) {
  const { pathname } = useLocation()
  const { user } = useAuth()

  // Filter tabs by role so the bar never shows a tab the user can't access.
  const visibleTabs = tabs.filter((tab) => {
    if (!tab.roles) return true
    return tab.roles.includes(user?.role as string)
  })

  return (
    <nav
      aria-label="Staff navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface/95 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {visibleTabs.map(({ to, label, icon: Icon, end, primary, onClick }) => {
          const isActive = onClick
            ? false
            : end
              ? pathname === to
              : pathname.startsWith(to)

          if (onClick === 'openMenu') {
            return (
              <button
                key={to}
                type="button"
                onClick={onOpenMenu}
                aria-label={label}
                className="relative -mt-4 flex flex-col items-center justify-center px-2"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90">
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={cn(
                    'mt-0.5 text-[10px] font-semibold',
                    'text-text-tertiary',
                  )}
                >
                  {label}
                </span>
              </button>
            )
          }

          if (primary) {
            return (
              <NavLink
                key={to}
                to={to}
                aria-label={label}
                className="relative -mt-4 flex flex-col items-center justify-center px-2"
              >
                <span
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={cn(
                    'mt-0.5 text-[10px] font-semibold',
                    isActive ? 'text-primary' : 'text-text-tertiary',
                  )}
                >
                  {label}
                </span>
              </NavLink>
            )
          }

          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={cn(
                'flex min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-text-tertiary hover:text-primary',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
