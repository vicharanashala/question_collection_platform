import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, FileText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { authApi, getErrorMessage } from "@/api/client";
import { LegalDocumentContent } from "@/components/ui/legal-document-content";

interface AnveshanWelcomeModalProps {
  open: boolean;
  name?: string | null;
  onConsentGiven: (
    updatedUser: Awaited<ReturnType<typeof authApi.updateMe>>,
  ) => void;
}

type Step = "welcome" | "consent";
type LegalTab = "terms" | "privacy";

export function AnveshanWelcomeModal({
  open,
  name,
  onConsentGiven,
}: AnveshanWelcomeModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("welcome");
  const [activeTab, setActiveTab] = useState<LegalTab>("terms");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await authApi.updateMe({ consentGiven: true });
      onConsentGiven(updated);
    } catch (e) {
      setError(getErrorMessage(e, "consent update"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      {/* No dismissal path except the flow's own buttons. */}
      <DialogContent
        className={cn(
          "[&>button]:hidden",
          step === "welcome"
            ? "sm:max-w-md p-6 sm:p-8"
            : "sm:max-w-lg flex max-h-[85vh] flex-col p-0",
        )}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {step === "welcome" ? (
          <>
            <DialogHeader className="items-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <DialogTitle className="text-center">
                {t("anveshan.welcomeTitle", {
                  defaultValue: name ? `Welcome, ${name}!` : "Welcome!",
                })}
              </DialogTitle>
              <DialogDescription className="text-center px-2">
                {t("anveshan.welcomeDescription", {
                  defaultValue:
                    "We've pulled your details from the Anveshan platform.",
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-2 sm:justify-center">
              <Button onClick={() => setStep("consent")} className="w-full sm:w-auto">
                {t("anveshan.continue", { defaultValue: "Continue" })}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* ── Tabs: Terms / Privacy ── */}
            <div className="flex border-b border-border-subtle">
              <button
                type="button"
                onClick={() => setActiveTab("terms")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-medium transition-colors",
                  activeTab === "terms"
                    ? "border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                {t("anveshan.terms", { defaultValue: "Terms of Service" })}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("privacy")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-medium transition-colors",
                  activeTab === "privacy"
                    ? "border-b-2 border-emerald-500 text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("anveshan.privacy", { defaultValue: "Privacy Policy" })}
              </button>
            </div>

            {/* Reused accordion content — no header, tabs already label it */}
            <LegalDocumentContent type={activeTab} showHeader={false} />

            {/* ── Consent checkbox + footer ── */}
            <div className="border-t border-border-subtle px-4 py-3">
              <div
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  agreed
                    ? "border-emerald-300 bg-emerald-50/40"
                    : "border-border bg-surface",
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setAgreed((v) => !v)}
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all",
                      agreed
                        ? "border-emerald-500 bg-emerald-500"
                        : "border-border-subtle bg-surface hover:border-emerald-400",
                    )}
                  >
                    {agreed && <Check className="h-3 w-3 text-white" />}
                  </button>
                  <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">
                    {t("anveshan.consentText", {
                      defaultValue:
                        "I have read and agree to the Terms of Service and Privacy Policy.",
                    })}
                  </p>
                </div>
              </div>

              {error && (
                <p className="mt-2 text-center text-[11px] text-rose-600">{error}</p>
              )}

              <Button
                onClick={handleContinue}
                disabled={!agreed || submitting}
                className="mt-3 w-full"
              >
                {submitting
                  ? t("anveshan.saving", { defaultValue: "Saving..." })
                  : t("anveshan.continue", { defaultValue: "Continue" })}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}