import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { LogOut, User, Sun, Moon, Languages } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { BrandLogo } from '@/components/BrandLogo'
import { useLanguage } from '@/hooks/useLanguage'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { SignOutDialog } from '@/components/SignOutDialog'

interface HeaderProps {}

export function Header({}: HeaderProps) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  useLanguage()
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
  titles[pathname]
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
    setProfileOpen(false)
    setLogoutConfirmOpen(true)
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <BrandLogo className="h-8 w-8 shrink-0" />
        <span className="text-sm sm:text-base font-bold text-text leading-tight">AnnaDatha</span>
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

        <button
          onClick={() => setLanguageOpen(true)}
          className="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-accent hover:text-text transition-colors"
          aria-label={t('auth.selectLanguage')}
          title={t('auth.selectLanguage')}
        >
          <Languages className="h-4 w-4" />
        </button>



        {/* Profile dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setProfileOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md p-1.5 hover:bg-accent transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] sm:text-[11px] sm:text-xs font-bold text-primary-foreground">
              {initials}
            </div>
            {user?.name && (
              <span className="text-xs sm:text-xs sm:text-sm font-medium text-text hidden sm:block">{user.name}</span>
            )}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border border-border-subtle bg-surface shadow-md z-50 overflow-hidden">
              {/* User info */}
              <div className="border-b border-border-subtle px-3 py-2.5">
                <p className="text-xs sm:text-xs sm:text-sm font-semibold text-text truncate">{user?.name || 'User'}</p>
                <p className="text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary truncate">{user?.mobileNumber}</p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => { toggleTheme(); setProfileOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-xs sm:text-xs sm:text-sm text-text hover:bg-accent transition-colors"
                >
                  {theme === 'dark' ? (
                    <><Sun className="h-4 w-4 text-text-tertiary" />{t('profile.themeLight')}</>
                  ) : (
                    <><Moon className="h-4 w-4 text-text-tertiary" />{t('profile.themeDark')}</>
                  )}
                </button>
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs sm:text-xs sm:text-sm text-text hover:bg-accent transition-colors"
                >
                  <User className="h-4 w-4 text-text-tertiary" />
                  {t('nav.profile')}
                </Link>
              </div>

              <div className="border-t border-border-subtle py-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-xs sm:text-xs sm:text-sm text-destructive hover:bg-destructive/5 transition-colors"
                >
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