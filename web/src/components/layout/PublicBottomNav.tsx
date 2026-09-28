import { NavLink, useLocation } from 'react-router-dom'
import { Home, MessageSquarePlus, Wallet, User, ListChecks, HelpCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { canAccessPayments, PAYMENT_ROUTES } from '@/utils/paymentAccess'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'


interface Tab {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
  primary?: boolean
}

const tabs: Tab[] = [
  { to: '/home',           label: 'Home',        icon: Home,             end: true },
  { to: '/home/questions', label: 'Submissions', icon: ListChecks },
  { to: '/home/ask',       label: 'Submit',      icon: MessageSquarePlus, primary: true },
  { to: '/home/wallet',    label: 'Wallet',      icon: Wallet },
  { to: '/home/profile',   label: 'Profile',     icon: User },
]

// Replaces the Wallet slot for users without payments, keeping five tabs so Submit stays centred.
const helpTab: Tab = { to: '/home/faqs', label: 'Help', icon: HelpCircle }

/**
 * Mobile bottom tab bar. Mirrors the mobile app's primary navigation
 * (Home / Submissions / Submit / Wallet / Profile) on small viewports.
 * Hidden on `md` and above where the desktop sidebar takes over.
 */
export function PublicBottomNav() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { user } = useAuth()
  const visibleTabs = canAccessPayments(user)
    ? tabs
    : tabs.map((tab) => (PAYMENT_ROUTES.includes(tab.to) ? helpTab : tab))

  return (
    <nav
      aria-label="Public navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-white/95 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] backdrop-blur dark:border-border-subtle dark:bg-surface/95 md:hidden"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {visibleTabs.map(({ to, label, icon: Icon, end, primary }) => {
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
              tabIndex={to === '/home/wallet' ? -1 : 0}
              onClick={(e) => {
                if (to === '/home/wallet') e.preventDefault()
              }}
              className={cn(
                'flex min-w-[56px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-text-tertiary hover:text-primary',
                to === '/home/wallet' && 'pointer-events-none opacity-50'
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {to === '/home/wallet' && (
                  <span className="absolute -right-4 -top-1.5 flex h-3.5 items-center justify-center rounded bg-warning px-1 text-[8px] font-bold uppercase tracking-wider text-warning-foreground shadow-sm">
                    {t('common.soon', 'Soon')}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}