import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { LogOut, User, Sun, Moon, Menu } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const titles: Record<string, string> = {
  '/public': 'Home',
  '/public/ask': 'Ask a Question',
  '/public/questions': 'My Questions',
  '/public/faqs': 'Help & FAQ',
  '/public/profile': 'Profile',
}

export function PublicHeader({ onMobileMenuToggle }: { onMobileMenuToggle?: () => void } = {}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const title = titles[pathname] ?? 'AnnaDatha'
  const initials = user ? getInitials(user.name || '', user.mobileNumber) : '?'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
          <button onClick={onMobileMenuToggle} className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-emerald-50 hover:text-emerald-700 md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-base font-bold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={toggleTheme} className="flex items-center justify-center rounded-md p-1.5 text-text-secondary hover:bg-emerald-50 hover:text-emerald-700 transition-colors" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
                  Profile
                </Link>
              </div>
              <div className="border-t border-border-subtle py-1">
                <button onClick={() => setLogoutConfirmOpen(true)} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Dialog open={logoutConfirmOpen} onOpenChange={(v) => setLogoutConfirmOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Out?</DialogTitle>
            <DialogDescription>Are you sure you want to sign out of your AnnaDatha account?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmLogout}>Sign Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}