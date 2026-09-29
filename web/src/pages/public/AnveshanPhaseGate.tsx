import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ExternalLink, Hourglass, LogIn, Mail, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import { ANVESHAN_PLATFORM_URL } from "@/constants/public";

interface AnveshanPhaseGateState {
  currentPhase: string;
  requiredPhase: string;
  /** Number the user signed in with, so "Check again" can prefill it. */
  mobileNumber?: string;
}

const PHASE_LABELS: Record<string, string> = {
  foundation: "Foundation",
  interview: "Interview",
  summary: "Summary",
  module: "Module",
};

// Readable phase name; unknown phases such as "document" are capitalised instead of shown raw.
function phaseLabel(phase: string) {
  return PHASE_LABELS[phase] ?? phase.charAt(0).toUpperCase() + phase.slice(1).replace(/[_-]+/g, " ");
}

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;
const ANVESHAN_LOGIN_PATH = "/login?isAnveshan=true";

/** Shown to Anveshan candidates who signed in before reaching the phase that unlocks this app. */
export function AnveshanPhaseGatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isAuthenticated } = useAuth();
  const info = location.state as AnveshanPhaseGateState | null;
  const requiredLabel = info ? phaseLabel(info.requiredPhase) : "Module";

  // Re-checking needs a fresh sign-in (the phase is only verified with an OTP), so any session is
  // cleared and the user returns to the Anveshan login with their number already filled in.
  const checkAgain = () => {
    if (isAuthenticated) logout();
    navigate(ANVESHAN_LOGIN_PATH, { replace: true, state: info?.mobileNumber ? { mobileNumber: info.mobileNumber } : undefined });
  };

  const backToLogin = () => {
    if (isAuthenticated) logout();
    navigate(ANVESHAN_LOGIN_PATH, { replace: true });
  };

  const contactSupport = () => {
    if (!SUPPORT_EMAIL) return;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Anveshan phase eligibility query")}`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_60%)] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="mb-5 flex items-center justify-center gap-2">
          <BrandLogo className="h-8 w-8" />
          <span className="text-sm font-bold text-foreground">AnnaDatha × Anveshan</span>
        </div>

        <Card className="overflow-hidden rounded-2xl p-0 shadow-lg">
          <div className="px-6 pb-6 pt-8 text-center sm:px-8">
            <motion.div
              initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.1 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40"
            >
              <Hourglass className="h-8 w-8 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            </motion.div>
            <h1 className="mt-5 text-xl font-bold text-foreground">You're almost there</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              You're registered on the Anveshan platform. This app opens once you reach the{" "}
              <strong className="text-foreground">{requiredLabel}</strong> phase.
            </p>

            {info && (
              <div className="mt-6 flex items-stretch gap-2" aria-label={`Current phase ${phaseLabel(info.currentPhase)}, required phase ${requiredLabel}`}>
                <div className="flex-1 rounded-xl border border-border-subtle bg-surface-variant/50 px-3 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Your phase</p>
                  <p className="mt-1 text-base font-bold text-foreground">{phaseLabel(info.currentPhase)}</p>
                </div>
                <div className="flex items-center text-muted-foreground" aria-hidden="true">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div className="flex-1 rounded-xl border border-primary/40 bg-primary/10 px-3 py-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-primary">Required</p>
                  <p className="mt-1 text-base font-bold text-foreground">{requiredLabel}</p>
                </div>
              </div>
            )}

            <ol className="mt-6 space-y-2 text-left text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                <span>Continue your journey on the Anveshan platform.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                <span>
                  Once you reach the <strong className="text-foreground">{requiredLabel}</strong> phase, tap{" "}
                  <strong className="text-foreground">Check again</strong> and sign in with a fresh code.
                </span>
              </li>
            </ol>
          </div>

          <div className="space-y-2 border-t border-border-subtle bg-surface-variant/30 px-6 py-5 sm:px-8">
            <Button className="w-full gap-2" onClick={checkAgain}>
              <RotateCw className="h-4 w-4" aria-hidden="true" />
              Check again
            </Button>
            <Button variant="outline" className="w-full gap-2" asChild>
              <a href={ANVESHAN_PLATFORM_URL} target="_blank" rel="noopener noreferrer">
                Go to Anveshan
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1">
              <Button variant="link" size="sm" className="gap-1.5 text-muted-foreground" onClick={backToLogin}>
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                Back to login
              </Button>
              {SUPPORT_EMAIL && (
                <Button variant="link" size="sm" className="gap-1.5 text-muted-foreground" onClick={contactSupport}>
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Contact support
                </Button>
              )}
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
