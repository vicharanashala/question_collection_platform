import { useState } from "react";
import { Mail, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { LinkEmailDialog } from "@/components/profile/LinkEmailDialog";

/**
 * Session-dismissible reminder shown in both authenticated app shells. It is
 * deliberately not persisted, so an unlinked account sees it again on refresh.
 */
export function EmailLinkBanner({ hidden = false }: { hidden?: boolean }) {
  const { user, updateUser } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (hidden || !user || user.email || dismissed) return null;

  return (
    <>
      <section className="relative overflow-hidden border-b border-primary/25 bg-primary/10 px-4 py-3 sm:px-6">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-3 pr-6 sm:flex-row sm:items-center sm:justify-between sm:pr-8">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Add a backup way to sign in</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-text-secondary sm:text-sm">
                Link your email to receive an OTP if mobile OTP delivery is unavailable.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setDialogOpen(true)} className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Link email
          </button>
        </div>
        <button type="button" aria-label="Dismiss email reminder" onClick={() => setDismissed(true)} className="absolute right-3 top-3 rounded-md p-1 text-text-tertiary transition-colors hover:bg-primary/10 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </section>

      <LinkEmailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onLinked={(email) => updateUser({ email })}
      />
    </>
  );
}
