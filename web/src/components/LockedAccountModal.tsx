import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  accountLockedEmitter,
  type AccountLockedInfo,
} from "@/events/accountLockedEvents";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Ban, PauseCircle } from "lucide-react";

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function LockedAccountModal() {
  const [lockedInfo, setLockedInfo] = useState<AccountLockedInfo | null>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = accountLockedEmitter.on((info) => {
      setLockedInfo(info);
      // Logout is also called by AuthContext's listener (independent of this
      // component), which triggers ProtectedRoute to redirect to /login.
      // Because the modal is rendered outside ProtectedRoute (at App level),
      // it stays mounted through the redirect and is visible as an interstitial.
    });
    return () => {
      unsubscribe();
    };
  }, []);

  async function handleLogout() {
    setLockedInfo(null);
    await logout();
    navigate("/login", { replace: true });
  }

  if (!lockedInfo) return null;

  const isBan = lockedInfo.status === "banned";
  const accentCls = isBan ? "text-red-600" : "text-amber-600";
  const bgCls = isBan
    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
    : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";

  const dateLabel = isBan ? "Banned on" : "Suspended on";
  const date = isBan ? lockedInfo.bannedAt : lockedInfo.suspendedAt;

  return (
    <Dialog open={!!lockedInfo} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full mb-3",
              isBan
                ? "bg-red-100 dark:bg-red-900/50"
                : "bg-amber-100 dark:bg-amber-900/50",
            )}
          >
            {isBan ? (
              <Ban className="h-7 w-7 text-red-600" />
            ) : (
              <PauseCircle className="h-7 w-7 text-amber-600" />
            )}
          </div>
          <DialogTitle className={cn("text-lg sm:text-lg sm:text-xl font-black", accentCls)}>
            {isBan ? "Account Permanently Banned" : "Account Suspended"}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Your access has been revoked. Sign out to return to the login
            screen.
          </DialogDescription>
        </DialogHeader>

        <div className={cn("rounded-lg border p-4 space-y-3", bgCls)}>
          {lockedInfo.reason && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Reason
              </p>
              <p className="text-xs sm:text-xs sm:text-sm text-foreground italic">
                &ldquo;{lockedInfo.reason}&rdquo;
              </p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              {dateLabel}
            </p>
            <p className="text-xs sm:text-xs sm:text-sm text-foreground">
              {formatDate(date)}
              {!isBan && lockedInfo.suspendedUntil && (
                <span className="text-muted-foreground">
                  {" "}
                  — until {formatDate(lockedInfo.suspendedUntil)}
                </span>
              )}
            </p>
          </div>
        </div>

        {SUPPORT_EMAIL ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground text-center">
              If you believe this was a mistake, contact support
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(isBan ? "Account ban appeal" : "Account suspension appeal")}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] sm:text-[11px] sm:text-xs font-semibold",
                isBan
                  ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                  : "border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30",
              )}
            >
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Send email
            </a>
          </div>
        ) : (
          <p className="text-[11px] sm:text-[11px] sm:text-xs text-center text-muted-foreground">
            If you believe this was a mistake, contact support.
          </p>
        )}

        <DialogFooter className="sm:justify-center">
          <Button className="w-full" onClick={handleLogout}>
            Sign Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
