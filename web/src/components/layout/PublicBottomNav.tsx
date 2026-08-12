import { NavLink, useLocation } from 'react-router-dom'
import { Home, MessageSquarePlus, Wallet, User, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
  primary?: boolean
}

const tabs: Tab[] = [
  { to: '/public',           label: 'Home',        icon: Home,             end: true },
  { to: '/public/questions', label: 'Submissions', icon: ListChecks },
  { to: '/public/ask',       label: 'Submit',      icon: MessageSquarePlus, primary: true },
  { to: '/public/wallet',    label: 'Wallet',      icon: Wallet },
  { to: '/public/profile',   label: 'Profile',     icon: User },
]

/**
 * Mobile bottom tab bar. Mirrors the mobile app's primary navigation
 * (Home / Submissions / Submit / Wallet / Profile) on small viewports.
 * Hidden on `md` and above where the desktop sidebar takes over.
 */
export function PublicBottomNav() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Public navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-100 bg-white/95 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] backdrop-blur dark:border-emerald-900/40 dark:bg-surface/95 md:hidden"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ to, label, icon: Icon, end, primary }) => {
          const isActive = end ? pathname === to : pathname.startsWith(to)

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
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={cn(
                    'mt-0.5 text-[10px] font-semibold',
                    isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-text-tertiary',
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
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-text-tertiary hover:text-emerald-700',
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