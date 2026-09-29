import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink, LogIn, Mail, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import { ANVESHAN_PLATFORM_URL } from "@/constants/public";
import { cn } from "@/lib/utils";
import { JOURNEY, JourneyStep, type PhaseStatus } from "@/components/AnveshanJourney";

interface AnveshanPhaseGateState {
  currentPhase: string;
  requiredPhase: string;
  /** Number the user signed in with, so "Check again" can prefill it. */
  mobileNumber?: string;
}

const DEFAULT_REQUIRED_PHASE = "module";
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;
const ANVESHAN_LOGIN_PATH = "/login?isAnveshan=true";

// Finds a phase's position in the journey, tolerating case and singular or plural spellings.
function phaseIndex(phase: string | undefined): number {
  if (!phase) return -1;
  const key = phase.trim().toLowerCase();
  return JOURNEY.findIndex((p) => p.id === key || p.id === `${key}s` || `${p.id}s` === key);
}

// Status of a journey step relative to the candidate's current phase and the phase that unlocks the app.
function statusFor(index: number, currentIndex: number, requiredIndex: number): PhaseStatus {
  if (currentIndex >= 0 && index < currentIndex) return "done";
  if (index === currentIndex) return "current";
  return index === requiredIndex ? "unlock" : "upcoming";
}

// Colour of one segment in the progress bar under the percentage.
function segmentClass(status: PhaseStatus): string {
  if (status === "done") return "bg-primary";
  if (status === "current") return "bg-amber-500";
  if (status === "unlock") return "bg-primary/25";
  return "bg-muted";
}

/** Shown to Anveshan candidates who signed in before reaching the phase that unlocks this app. */
export function AnveshanPhaseGatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, isAuthenticated } = useAuth();
  const info = location.state as AnveshanPhaseGateState | null;

  const currentIndex = phaseIndex(info?.currentPhase);
  const requiredIndex = Math.max(phaseIndex(info?.requiredPhase ?? DEFAULT_REQUIRED_PHASE), 0);
  const requiredLabel = JOURNEY[requiredIndex].label;
  const currentLabel = currentIndex >= 0 ? JOURNEY[currentIndex].label : null;
  const progressPercent = currentIndex >= 0 ? Math.round(((currentIndex + 1) / JOURNEY.length) * 100) : 0;
  const statuses = JOURNEY.map((_, i) => statusFor(i, currentIndex, requiredIndex));

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

  const actions = (
    <div className="space-y-2">
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
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.12),transparent_60%)] px-4 py-8 sm:py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-md lg:max-w-4xl"
      >
        <div className="mb-5 flex items-center justify-center gap-2">
          <BrandLogo className="h-8 w-8" />
          <span className="text-sm font-bold text-foreground">AnnaDatha × Anveshan</span>
        </div>

        <Card className="overflow-hidden rounded-2xl p-0 shadow-lg lg:grid lg:grid-cols-[0.9fr_1.1fr]">
          {/* Progress summary; actions sit here on desktop */}
          <div className="flex flex-col px-6 pb-6 pt-8 lg:border-r lg:border-border-subtle">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-emerald-400">
              Towards Verified Agriculture Expert
            </p>

            {currentLabel && (
              <>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-6xl font-extrabold leading-none text-primary dark:text-emerald-400">
                    {progressPercent}%
                  </span>
                  <span className="pb-1 text-sm text-muted-foreground">journey complete</span>
                </div>
                <div
                  className="mt-5 flex gap-1.5"
                  role="progressbar"
                  aria-label="Journey progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                  aria-valuetext={`Step ${currentIndex + 1} of ${JOURNEY.length}`}
                >
                  {statuses.map((status, i) => (
                    <motion.span
                      key={JOURNEY[i].id}
                      className={cn("h-2 flex-1 origin-left rounded-full", segmentClass(status))}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.3, delay: 0.15 + i * 0.06, ease: "easeOut" }}
                    />
                  ))}
                </div>
              </>
            )}

            <h1 className="mt-6 text-xl font-bold text-foreground">You're almost there</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              AnnaDatha unlocks at <strong className="text-foreground">{requiredLabel}</strong>.{" "}
              {currentLabel ? (
                <>
                  Finish <strong className="text-foreground">{currentLabel}</strong> on Anveshan, then check again.
                </>
              ) : (
                <>Continue on Anveshan, then check again.</>
              )}
            </p>

            <div className="mt-auto hidden pt-8 lg:block">{actions}</div>
          </div>

          {/* Journey list */}
          <section aria-label="Your Anveshan journey" className="px-5 pb-6 sm:px-6 lg:bg-surface-variant/20 lg:py-8">
            <ol className="space-y-2">
              {JOURNEY.map((phase, i) => (
                <JourneyStep key={phase.id} phase={phase} status={statuses[i]} />
              ))}
            </ol>
          </section>

          <div className="border-t border-border-subtle bg-surface-variant/30 px-5 py-5 lg:hidden">{actions}</div>
        </Card>
      </motion.div>
    </div>
  );
}
