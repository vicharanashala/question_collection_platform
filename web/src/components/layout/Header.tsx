import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Sun, Moon, LogOut, User, Menu } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/users': 'User Management',
  '/questions': 'Questions',
  '/reviews': 'Review Queue',
  '/profile': 'Profile',
}

interface HeaderProps {
  onMobileMenuToggle?: () => void
}

export function Header({ onMobileMenuToggle }: HeaderProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const title = titles[pathname] ?? 'Question Platform'
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
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex items-center gap-2">
        {/* Mobile menu toggle */}
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-6 w-px bg-border" />

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
              <span className="text-sm font-medium text-foreground hidden sm:block">{user.name}</span>
            )}
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border bg-popover shadow-md z-50 overflow-hidden">
              {/* User info */}
              <div className="border-b px-3 py-2.5">
                <p className="text-sm font-semibold text-foreground truncate">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.mobileNumber}</p>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  Profile
                </Link>

                {/* Theme toggle */}
                <button
                  onClick={() => { toggleTheme(); setProfileOpen(false) }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="h-4 w-4 text-muted-foreground" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="h-4 w-4 text-muted-foreground" />
                      Dark Mode
                    </>
                  )}
                </button>
              </div>

              <div className="border-t py-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
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
            <DialogTitle>Sign Out?</DialogTitle>
            <DialogDescription>
              Are you sure you want to sign out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmLogout}>
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}