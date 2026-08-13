import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/hooks/useLanguage'
import { LogOut, User, Sun, Moon, Menu, Bell, Trophy, Languages, ChevronRight } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { notificationApi } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

export function PublicHeader({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void } = {}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const { nativeName } = useLanguage()
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const titles: Record<string, string> = {
    '/public': t('nav.home'),
    '/public/ask': t('nav.submit'),
    '/public/questions': t('nav.submissions'),
    '/public/faqs': t('faq.title'),
    '/public/profile': t('nav.profile'),
    '/public/wallet': t('nav.wallet'),
    '/public/payment-methods': t('profile.paymentMethods'),
    '/public/terms': t('profile.termsOfService'),
    '/public/privacy': t('profile.privacyPolicy'),
    '/public/notifications': t('notifications.title'),
    '/public/leaderboard': t('leaderboard.title'),
  }
  const title = titles[pathname] ?? 'AnnaDatha'
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
    if (pathname === '/public/notifications') return
    notificationApi.getNotifications({ page: 1, limit: 1 })
      .then((res) => setUnreadCount(res.unread))
      .catch(() => {})
  }, [pathname])

  function confirmLogout() {
    setLogoutConfirmOpen(false)
    setProfileOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-emerald-100 bg-white/80 backdrop-blur px-4 sm:px-6 dark:border-emerald-900/40 dark:bg-surface/80">
      <div className="flex items-center gap-2">
        {onMobileMenuToggle && (
          <button onClick={onMobileMenuToggle} className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-emerald-50 hover:text-emerald-700 md:hidden" aria-label={t('chrome.openMenu')}>
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-base font-bold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/public/notifications')} className="relative flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-emerald-50 hover:text-emerald-700 transition-colors" aria-label="Notifications" title="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-bold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        <button onClick={() => setLanguageOpen(true)} className="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-emerald-50 hover:text-emerald-700 transition-colors" aria-label="Change language" title="Change language">
          <Languages className="h-4 w-4" />
        </button>
        <button onClick={toggleTheme} className="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-emerald-50 hover:text-emerald-700 transition-colors" aria-label={theme === 'dark' ? t('chrome.switchToLightMode') : t('chrome.switchToDarkMode')} title={theme === 'dark' ? t('profile.themeLight') : t('profile.themeDark')}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button onClick={() => navigate('/public/leaderboard')} className="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-emerald-50 hover:text-emerald-700 transition-colors" aria-label={t('leaderboard.title')} title={t('leaderboard.title')}>
          <Trophy className="h-4 w-4" />
        </button>
        <div className="h-6 w-px bg-border-subtle" />
        <div className="relative" ref={menuRef}>
          <button onClick={() => setProfileOpen((o) => !o)} className="flex items-center gap-2 rounded-md p-1.5 hover:bg-emerald-50 transition-colors">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">{initials}</div>
            {user?.name && <span className="text-sm font-medium text-foreground hidden sm:block">{user.name}</span>}
          </button>
          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border border-border-subtle bg-white shadow-lg z-50 overflow-hidden dark:bg-surface">
              <div className="border-b border-border-subtle px-3 py-2.5">
                <p className="text-sm font-semibold text-foreground truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-text-tertiary truncate">{user?.mobileNumber}</p>
              </div>
              <div className="py-1">
                <Link to="/public/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors">
                  <User className="h-4 w-4 text-text-tertiary" />
                  {t('nav.profile')}
                </Link>
                <button
                  onClick={() => { setProfileOpen(false); setLanguageOpen(true) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <Languages className="h-4 w-4 text-text-tertiary" />
                  <span className="flex-1 text-left">{t('auth.selectLanguage')}</span>
                  <span className="text-xs text-text-tertiary">{nativeName}</span>
                  <ChevronRight className="h-4 w-4 text-text-tertiary" />
                </button>
              </div>
              <div className="border-t border-border-subtle py-1">
                <button onClick={() => setLogoutConfirmOpen(true)} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                  <LogOut className="h-4 w-4" />
                  {t('profile.signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Dialog open={logoutConfirmOpen} onOpenChange={(v) => setLogoutConfirmOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('profile.signOut')}</DialogTitle>
            <DialogDescription>{t('profile.signOutConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)}>{t('profile.signOutCancel')}</Button>
            <Button variant="destructive" onClick={confirmLogout}>{t('profile.signOutAction')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <LanguageSwitcher open={languageOpen} onClose={() => setLanguageOpen(false)} />
    </header>
  )
}