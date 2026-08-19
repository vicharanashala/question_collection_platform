/**
 * Complete-profile modal: hosts the multi-step profile wizard inside a Dialog.
 *
 * Mounted from `PublicLayout` whenever the current public user hasn't
 * finished profile setup (either they haven't completed the wizard yet —
 * we know via router state or via `user.consentGiven === false`).
 *
 * Behaviour — by design the modal is **non-dismissible** while the user
 * hasn't completed registration:
 *   • No close (X) button inside the dialog content.
 *   • Backdrop click is ignored (Radix `onInteractOutside` blocked).
 *   • Escape keypress does not close it.
 *
 * The overlay is intentionally translucent (not opaque black) so the
 * `/home` dashboard remains partially visible behind the modal — matches
 * the requested "somewhat transparent background".
 *
 * On successful registration the wizard calls `login(...)` and navigates
 * to `/home/verification-pending`, so the modal unmounts naturally.
 */
import { Dialog, DialogContent, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { CompleteProfileWizard } from './CompleteProfileWizard'

interface CompleteProfileModalProps {
  open: boolean
  /** Mobile number being registered (used by `authApi.register`). */
  mobileNumber: string
}

export function CompleteProfileModal({ open, mobileNumber }: CompleteProfileModalProps) {
  return (
    <Dialog
      // The onOpenChange handler intentionally rejects close attempts so the
      // user cannot bail out of profile setup by clicking the overlay or
      // pressing Escape. The wizard navigates away on success, which is the
      // only legitimate way to close this modal.
      open={open}
      onOpenChange={(next) => {
        // `next === false` means something is trying to close us. Swallow.
        if (!next) return
        // `next === true` is an open request — nothing to do, parent already
        // manages `open` via prop.
      }}
    >
      <DialogPortal>
        {/*
          * Custom translucent overlay: classic dialog uses bg-black/40 (or
          * bg-black/70 in dark mode). Here we lighten it further to honor
          * the "somewhat transparent" requirement, while still dimming the
          * dashboard below so the wizard remains the visual focus.
          */}
        <DialogOverlay className="bg-black/30 backdrop-blur-[2px] dark:bg-black/50" />
        <DialogContent
          // Disable the standard ESC / backdrop dismissals
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          // Hide the default X close button — there's no legitimate way
          // for the user to dismiss this modal until registration completes.
          hideCloseButton
          className="h-[96vh] w-[70vw] min-w-[65vw] max-w-[75vw] p-5 sm:p-6"
        >
          <CompleteProfileWizard mobileNumber={mobileNumber} />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
