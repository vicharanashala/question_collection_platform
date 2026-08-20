import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { LogOut, User, Sun, Moon, Bell, Trophy, Languages } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { BrandLogo } from '@/components/BrandLogo'
import { useLanguage } from '@/hooks/useLanguage'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { notificationApi } from '@/api/client'
import { SignOutDialog } from '@/components/SignOutDialog'

export function PublicHeader() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  useLanguage()
  const [unreadCount, setUnreadCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const titles: Record<string, string> = {
    '/home': t('nav.home'),
    '/home/ask': t('nav.submit'),
    '/home/questions': t('nav.submissions'),
    '/home/faqs': t('faq.title'),
    '/home/profile': t('nav.profile'),
    '/home/wallet': t('nav.wallet'),
    '/home/payment-methods': t('profile.paymentMethods'),
    '/home/terms': t('profile.termsOfService'),
    '/home/privacy': t('profile.privacyPolicy'),
    '/home/notifications': t('notifications.title'),
    '/home/leaderboard': t('leaderboard.title'),
  }
  titles[pathname]
  const initials = user ? getInitials(user.name || '', user.mobileNumber) : '?'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Refresh the unread badge on mount and whenever the user navigates away
  // from the notifications page (covers "just read some notifications").
  useEffect(() => {
    if (pathname === '/home/notifications') return
    notificationApi.getNotifications({ page: 1, limit: 1 })
      .then((res) => setUnreadCount(res.unread))
      .catch(() => {})
  }, [pathname])

  function handleLogout() {
    setProfileOpen(false)
    setLogoutConfirmOpen(true)
  }

  return (
    <header className="relative z-30 flex h-14 items-center justify-between border-b border-border-subtle bg-white/80 backdrop-blur px-4 sm:px-6 dark:border-border-subtle dark:bg-surface/80">
      <button
        onClick={() => navigate('/home')}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label="AnnaDatha — go to home"
      >
        <BrandLogo className="h-8 w-8 shrink-0" />
        <span className="text-sm sm:text-base font-bold text-foreground leading-tight">AnnaDatha</span>
      </button>
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/home/notifications')} className="relative flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-surface-variant hover:text-foreground transition-colors" aria-label={t('notifications.title')} title={t('notifications.title')}>
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button onClick={toggleTheme} className="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-surface-variant hover:text-foreground transition-colors" aria-label={theme === 'dark' ? t('profile.themeLight') : t('profile.themeDark')} title={theme === 'dark' ? t('profile.themeLight') : t('profile.themeDark')}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button onClick={() => navigate('/home/leaderboard')} className="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-surface-variant hover:text-foreground transition-colors" aria-label={t('leaderboard.title')} title={t('leaderboard.title')}>
          <Trophy className="h-4 w-4" />
        </button>
        <button onClick={() => setLanguageOpen(true)} className="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-surface-variant hover:text-foreground transition-colors" aria-label={t('auth.selectLanguage')} title={t('auth.selectLanguage')}>
          <Languages className="h-4 w-4" />
        </button>
        <div className="h-6 w-px bg-border-subtle" />
        <div className="relative" ref={menuRef}>
          <button onClick={() => setProfileOpen((o) => !o)} className="flex items-center gap-2 rounded-md p-1.5 hover:bg-surface-variant transition-colors">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] sm:text-[11px] sm:text-xs font-bold text-primary-foreground">{initials}</div>
            {user?.name && <span className="text-xs sm:text-xs sm:text-sm font-medium text-foreground hidden sm:block">{user.name}</span>}
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border border-border-subtle bg-white shadow-lg z-50 overflow-hidden dark:bg-surface">
              <div className="border-b border-border-subtle px-3 py-2.5">
                <p className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary truncate">{user?.mobileNumber}</p>
              </div>
              <div className="py-1">
                <Link to="/home/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-xs sm:text-xs sm:text-sm text-foreground hover:bg-accent transition-colors">
                  <User className="h-4 w-4 text-text-tertiary" />
                  {t('nav.profile')}
                </Link>
              </div>
              <div className="border-t border-border-subtle py-1">
                <button onClick={handleLogout} className="flex w-full items-center gap-2.5 px-3 py-2 text-xs sm:text-xs sm:text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                  <LogOut className="h-4 w-4" />
                  {t('profile.signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <SignOutDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        onSignOut={() => setProfileOpen(false)}
      />
      <LanguageSwitcher open={languageOpen} onClose={() => setLanguageOpen(false)} />
    </header>
  )
}