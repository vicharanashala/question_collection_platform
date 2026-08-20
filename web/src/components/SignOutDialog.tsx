import * as DialogPrimitive from '@radix-ui/react-dialog'
import { LogOut, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called immediately before logout + navigate — use to close parent dropdowns/menus */
  onSignOut?: () => void
}

export function SignOutDialog({ open, onOpenChange, onSignOut }: SignOutDialogProps) {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    onOpenChange(false)
    onSignOut?.()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideCloseButton className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* Coloured top band */}
        <div className="flex flex-col items-center gap-3 bg-gradient-to-b from-rose-50 to-white px-6 pt-6 pb-5 dark:from-rose-950/40 dark:to-surface">
          {/* Icon circle */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50">
            <LogOut className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          </div>
          <DialogTitle className="text-center text-lg font-bold text-foreground sm:text-xl">
            {t('profile.signOut')}?
          </DialogTitle>
          <p className="text-center text-sm text-text-secondary">
            {t('profile.signOutConfirm')}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 px-6 pb-6 pt-1 sm:flex-row sm:pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 justify-center"
          >
            {t('editProfile.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSignOut}
            className="flex-1 justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            {t('profile.signOutAction')}
          </Button>
        </div>

        {/* Close button */}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-sm opacity-60 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-focus sm:right-4 sm:top-4">
          <X className="h-4 w-4 text-text-tertiary" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogContent>
    </Dialog>
  )
}