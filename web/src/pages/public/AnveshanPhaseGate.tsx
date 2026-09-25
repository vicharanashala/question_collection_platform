import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Hourglass, Mail } from "lucide-react";

interface AnveshanPhaseInfo {
  currentPhase: string;
  requiredPhase: string;
}

const PHASE_LABELS: Record<string, string> = {
  foundation: "Foundation",
  interview: "Interview",
  summary: "Summary",
  module: "Module"
};

function phaseLabel(phase: string) {
  return PHASE_LABELS[phase] ?? phase;
}

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;

export function AnveshanPhaseGatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const info = location.state as AnveshanPhaseInfo | null;

  const handleContactSupport = () => {
    if (!SUPPORT_EMAIL) return;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      "Anveshan phase eligibility query",
    )}`;
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <Card className="w-full max-w-md p-6 sm:p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <Hourglass className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-lg font-bold text-foreground sm:text-xl">
          Not yet eligible
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          You're registered on the Anveshan platform, but this app is only
          available once you reach the{" "}
          <strong className="text-foreground">
            {info ? phaseLabel(info.requiredPhase) : "required"}
          </strong>{" "}
          phase.
        </p>
        {info && (
          <div className="mt-4 rounded-lg border border-border-subtle bg-surface px-4 py-3 text-left text-xs sm:text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Your current phase</span>
              <span className="font-semibold text-foreground">
                {phaseLabel(info.currentPhase)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Required phase</span>
              <span className="font-semibold text-foreground">
                {phaseLabel(info.requiredPhase)}
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {SUPPORT_EMAIL && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={handleContactSupport}
            >
              <Mail className="mr-1.5 h-4 w-4" />
              Contact Support
            </Button>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate("/login", { replace: true })}
          >
            Back to Login
          </Button>
        </div>
      </Card>
    </div>
  );
}
