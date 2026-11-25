import { useState } from "react";
import { AnimatePresence, motion, type TargetAndTransition, type Transition } from "framer-motion";
import { ArrowRight, MailCheck, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LinkEmailDialog } from "@/components/profile/LinkEmailDialog";

// Gentle ease-out used for the banner entrance and exit.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// The icon tile pops in after the banner opens, then the envelope gives a short
// nudge every few seconds. Layouts set reducedMotion="user", which turns these off.
const ICON_POP_IN: Transition = { type: "spring", stiffness: 420, damping: 18, delay: 0.25 };
const ICON_NUDGE: TargetAndTransition = {
  rotate: [0, -12, 10, -6, 0],
  transition: { duration: 0.7, ease: "easeInOut", delay: 1.2, repeat: Infinity, repeatDelay: 4 },
};

/**
 * Reminder shown in both app shells, including the profile pages, until the account
 * links a backup email. Dismissing hides it for this session only.
 */
export function EmailLinkBanner() {
  const { user, updateUser } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const visible = !!user && !user.email && !dismissed;

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.section
            key="email-link-banner"
            aria-labelledby="email-link-banner-title"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="relative border-b border-border-subtle bg-primary/5">
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-primary" />
              <motion.div
                initial={{ y: -6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.12, duration: 0.3, ease: EASE_OUT }}
                className="mx-auto flex max-w-7xl flex-col gap-2 py-2.5 pl-5 pr-4 sm:flex-row sm:items-center sm:gap-6 sm:px-6"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <motion.span
                    aria-hidden="true"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={ICON_POP_IN}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 dark:text-emerald-300 dark:ring-emerald-400/30"
                  >
                    <motion.span className="flex" animate={ICON_NUDGE}>
                      <MailCheck className="h-4 w-4" />
                    </motion.span>
                  </motion.span>
                  <div className="min-w-0">
                    <h2 id="email-link-banner-title" className="text-sm font-semibold leading-snug text-text">
                      Add a backup email
                    </h2>
                    <p className="text-xs leading-snug text-text-secondary">
                      Get sign-in codes by email if SMS fails.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-11 sm:shrink-0 sm:pl-0">
                  <Button
                    size="sm"
                    className="h-9 flex-1 gap-1.5 text-xs sm:h-8 sm:flex-none"
                    onClick={() => setDialogOpen(true)}
                  >
                    Link email
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Dismiss backup email reminder"
                    title="Dismiss"
                    className="h-9 w-9 shrink-0 p-0 text-text-secondary hover:text-text sm:h-8 sm:w-8"
                    onClick={() => setDismissed(true)}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </motion.div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <LinkEmailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onLinked={(email) => updateUser({ email })}
      />
    </>
  );
}
