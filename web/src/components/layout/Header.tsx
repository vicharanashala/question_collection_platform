import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/hooks/useLanguage'
import { LogOut, User, Menu, Sun, Moon, Languages, ChevronRight } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  onMobileMenuToggle?: () => void
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const { nativeName } = useLanguage()
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Title map keyed by route — translated via t() (i18next) so it re-renders
  // on language change. Unknown routes fall back to the platform name.
  const titles: Record<string, string> = {
    '/dashboard': t('pageTitle.dashboard'),
    '/users': t('pageTitle.userManagement'),
    '/questions': t('pageTitle.questions'),
    '/reviews': t('pageTitle.reviewQueue'),
    '/profile': t('pageTitle.profile'),
  }
  const title = titles[pathname] ?? t('pageTitle.questionPlatform')
  const initials = user ? getInitials(user.name || '', user.mobileNumber) : '?'

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleLogout() {
    setLogoutConfirmOpen(true)
  }

  function confirmLogout() {
    setLogoutConfirmOpen(false)
    setProfileOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-2">
        {/* Mobile menu toggle */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden rounded-md p-1.5 text-text-secondary hover:bg-accent hover:text-text transition-colors"
          aria-label={t('chrome.openMenu')}
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-text">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-accent hover:text-text transition-colors"
          aria-label={theme === 'dark' ? t('profile.themeLight') : t('profile.themeDark')}
          title={theme === 'dark' ? t('profile.themeLight') : t('profile.themeDark')}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Language switcher quick-action */}
        <button
          onClick={() => setLanguageOpen(true)}
          className="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-accent hover:text-text transition-colors"
          aria-label={t('auth.selectLanguage')}
          title={t('auth.selectLanguage')}
        >
          <Languages className="h-4 w-4" />
        </button>

        <div className="h-6 w-px bg-border-subtle" />

        {/* Profile dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md p-1.5 hover:bg-accent transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </div>
            {user?.name && (
              <span className="text-sm font-medium text-text hidden sm:block">{user.name}</span>
            )}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border border-border-subtle bg-surface shadow-md z-50 overflow-hidden">
              {/* User info */}
              <div className="border-b border-border-subtle px-3 py-2.5">
                <p className="text-sm font-semibold text-text truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-text-tertiary truncate">{user?.mobileNumber}</p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => { toggleTheme(); setProfileOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-accent transition-colors"
                >
                  {theme === 'dark' ? (
                    <><Sun className="h-4 w-4 text-text-tertiary" />{t('profile.themeLight')}</>
                  ) : (
                    <><Moon className="h-4 w-4 text-text-tertiary" />{t('profile.themeDark')}</>
                  )}
                </button>
                <button
                  onClick={() => { setProfileOpen(false); setLanguageOpen(true) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-accent transition-colors"
                >
                  <Languages className="h-4 w-4 text-text-tertiary" />
                  <span className="flex-1 text-left">{t('auth.selectLanguage')}</span>
                  <span className="text-xs text-text-tertiary">{nativeName}</span>
                  <ChevronRight className="h-4 w-4 text-text-tertiary" />
                </button>
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-accent transition-colors"
                >
                  <User className="h-4 w-4 text-text-tertiary" />
                  {t('nav.profile')}
                </Link>
              </div>

              <div className="border-t border-border-subtle py-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {t('profile.signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logout confirmation */}
      <Dialog open={logoutConfirmOpen} onOpenChange={(v) => { setLogoutConfirmOpen(v) }}>
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
            <Button variant="destructive" onClick={confirmLogout}>
              {t('profile.signOutAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LanguageSwitcher open={languageOpen} onClose={() => setLanguageOpen(false)} />
    </header>
  )
}