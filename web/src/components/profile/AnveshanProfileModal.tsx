import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Tag,
  User as UserIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authApi, getErrorMessage } from "@/api/client";
import { TERMS_SECTIONS, PRIVACY_POLICY_SECTIONS } from "@/constants/legal";
import { categoryLabel } from "@/constants/public";
import type { AuthUser } from "@/types";

const ANVESHAN_URL = "https://anveshan.annam.ai/";
// Distance from the bottom (px) that still counts as having read to the end.
const END_THRESHOLD_PX = 24;

type Step = "welcome" | "legal";
type LegalTab = "terms" | "privacy";
type TranslateFn = (key: string, opts?: Record<string, unknown>) => string;

interface AnveshanWelcomeModalProps {
  open: boolean;
  user: AuthUser | null;
  onConsentGiven: (
    updatedUser: Awaited<ReturnType<typeof authApi.updateMe>>,
  ) => void;
}

interface DetailItem {
  key: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

const LEGAL_SECTIONS: Record<LegalTab, typeof TERMS_SECTIONS> = {
  terms: TERMS_SECTIONS,
  privacy: PRIVACY_POLICY_SECTIONS,
};

const stepMotion = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.2, ease: "easeOut" },
} as const;

// Builds the list of imported profile fields, skipping any that are empty.
function buildDetails(user: AuthUser | null, t: TranslateFn): DetailItem[] {
  if (!user) return [];
  const location = [user.village, user.block, user.district, user.state]
    .filter(Boolean)
    .join(", ");
  const items: (DetailItem | null)[] = [
    user.name
      ? { key: "name", icon: UserIcon, label: t("anveshan.detailName", { defaultValue: "Name" }), value: user.name }
      : null,
    user.mobileNumber
      ? { key: "mobile", icon: Phone, label: t("anveshan.detailMobile", { defaultValue: "Mobile" }), value: user.mobileNumber }
      : null,
    user.category
      ? { key: "category", icon: Tag, label: t("anveshan.detailCategory", { defaultValue: "Category" }), value: categoryLabel(t, user.category) }
      : null,
    location
      ? { key: "location", icon: MapPin, label: t("anveshan.detailLocation", { defaultValue: "Location" }), value: location }
      : null,
  ];
  return items.filter((item): item is DetailItem => item !== null);
}

// Returns the translated display title of a legal document.
function legalTitle(tab: LegalTab, t: TranslateFn): string {
  return tab === "terms"
    ? t("anveshan.terms", { defaultValue: "Terms of Service" })
    : t("anveshan.privacy", { defaultValue: "Privacy Policy" });
}

// Small "Step X of 2" label with a two-segment progress indicator.
function StepIndicator({ current, t }: { current: 1 | 2; t: TranslateFn }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 w-6 rounded-full transition-colors",
              n <= current ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {t("anveshan.stepOf", { current, total: 2, defaultValue: `Step ${current} of 2` })}
      </span>
    </div>
  );
}

interface LegalReaderProps {
  tab: LegalTab;
  label: string;
  endContent: ReactNode;
  onProgress: (tab: LegalTab, ratio: number) => void;
}

// Renders a full legal document and reports how far the user has scrolled through it.
function LegalReader({ tab, label, endContent, onProgress }: LegalReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sections = LEGAL_SECTIONS[tab];

  const reportProgress = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight - el.clientHeight;
    const reachedEnd = scrollable - el.scrollTop <= END_THRESHOLD_PX;
    onProgress(tab, reachedEnd || scrollable <= 0 ? 1 : el.scrollTop / scrollable);
  }, [onProgress, tab]);

  // Short documents that fit without scrolling count as read immediately.
  useEffect(() => {
    reportProgress();
  }, [reportProgress]);

  return (
    <div
      ref={scrollRef}
      onScroll={reportProgress}
      tabIndex={0}
      role="document"
      aria-label={label}
      className="min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <div className="mx-auto max-w-2xl px-5 py-6 sm:px-10 sm:py-8">
        <ol className="space-y-7">
          {sections.map(({ id, title, body }) => (
            <li key={id} className="flex gap-4">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {id}
              </span>
              <div className="min-w-0">
                <h4 className="text-base font-semibold text-foreground">{title}</h4>
                <p className="mt-1.5 text-sm leading-7 text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-col items-center gap-3 border-t pt-8 text-center">{endContent}</div>
      </div>
    </div>
  );
}

interface ConsentCheckboxProps {
  checked: boolean;
  enabled: boolean;
  label: string;
  onToggle: () => void;
}

// Consent checkbox that stays locked until its document has been read to the end.
function ConsentCheckbox({ checked, enabled, label, onToggle }: ConsentCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={!enabled}
      onClick={onToggle}
      className="group flex items-center gap-2.5 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : enabled
              ? "border-input bg-background group-hover:border-primary/60"
              : "border-border bg-muted",
        )}
      >
        {checked ? <Check className="size-3.5" strokeWidth={3} /> : !enabled && <Lock className="size-3 text-muted-foreground" />}
      </span>
      <span className={cn("text-sm", enabled ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </button>
  );
}

// Two-step onboarding for users imported from Anveshan: review imported details, then read and accept the Terms and Privacy Policy.
export function AnveshanWelcomeModal({ open, user, onConsentGiven }: AnveshanWelcomeModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("welcome");
  const [activeTab, setActiveTab] = useState<LegalTab>("terms");
  const [readProgress, setReadProgress] = useState<Record<LegalTab, number>>({ terms: 0, privacy: 0 });
  const [accepted, setAccepted] = useState<Record<LegalTab, boolean>>({ terms: false, privacy: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const details = buildDetails(user, t);
  const name = user?.name;
  const hasRead = (tab: LegalTab) => readProgress[tab] >= 1;
  const canSubmit = accepted.terms && accepted.privacy && !submitting;

  // Keeps the furthest scroll position reached so progress never goes backwards.
  const handleProgress = useCallback((tab: LegalTab, ratio: number) => {
    setReadProgress((prev) => (ratio > prev[tab] ? { ...prev, [tab]: ratio } : prev));
  }, []);

  const toggleAccepted = (tab: LegalTab) => {
    setAccepted((prev) => ({ ...prev, [tab]: !prev[tab] }));
    setError(null);
  };

  // Saves consent and hands the refreshed user back to the parent.
  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const updatedUser = await authApi.updateMe({ consentGiven: true });
      onConsentGiven(updatedUser);
    } catch (e) {
      setError(getErrorMessage(e, "consent update"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      {/* Consent is mandatory, so the only way out is the flow's own buttons. */}
      <DialogContent
        className={cn(
          "[&>button]:hidden flex w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 shadow-2xl sm:max-w-2xl sm:rounded-2xl lg:max-w-3xl",
          step === "legal" ? "h-[min(94dvh,860px)]" : "max-h-[94dvh]",
        )}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <AnimatePresence mode="wait" initial={false}>
          {step === "welcome" ? (
            <motion.div key="welcome" {...stepMotion} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-6 sm:px-10 sm:pt-10">
                <DialogHeader className="space-y-4 text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="size-6" aria-hidden="true" />
                    </div>
                    <StepIndicator current={1} t={t} />
                  </div>
                  <div className="space-y-2">
                    <DialogTitle className="text-2xl font-semibold leading-tight sm:text-3xl">
                      {name
                        ? t("anveshan.welcomeTitleNamed", { name, defaultValue: `Welcome, ${name}` })
                        : t("anveshan.welcomeTitle", { defaultValue: "Welcome" })}
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-6 sm:text-base sm:leading-7">
                      {t("anveshan.welcomeDescriptionShort", {
                        defaultValue: "Your account is ready. We've brought over these details from your",
                      })}{" "}
                      <a
                        href={ANVESHAN_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t("anveshan.profileLink", { defaultValue: "Anveshan profile" })}
                        <ExternalLink className="size-3" aria-hidden="true" />
                        <span className="sr-only">{t("anveshan.opensNewTab", { defaultValue: "(opens in a new tab)" })}</span>
                      </a>
                      .
                    </DialogDescription>
                  </div>
                </DialogHeader>

                {details.length > 0 && (
                  <dl className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2">
                    {details.map(({ key, icon: Icon, label, value }) => (
                      <div
                        key={key}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border bg-card p-4",
                          key === "location" && "sm:col-span-2",
                        )}
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="size-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <dt className="text-xs text-muted-foreground">{label}</dt>
                          <dd className="mt-0.5 break-words text-sm font-semibold text-foreground">{value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                )}

                <p className="mt-3 text-xs text-muted-foreground">
                  {t("anveshan.detailsHint", { defaultValue: "You can update these details later from your profile." })}
                </p>
              </div>

              <footer className="shrink-0 px-5 pb-5 pt-4 sm:flex sm:justify-end sm:px-10 sm:pb-8 sm:pt-6">
                <Button size="lg" className="w-full sm:w-auto sm:min-w-40" onClick={() => setStep("legal")}>
                  {t("anveshan.next", { defaultValue: "Next" })}
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Button>
              </footer>
            </motion.div>
          ) : (
            <motion.div key="legal" {...stepMotion} className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 px-5 pt-5 sm:px-10 sm:pt-7">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStep("welcome")}
                    disabled={submitting}
                    className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    {t("anveshan.back", { defaultValue: "Back" })}
                  </button>
                  <StepIndicator current={2} t={t} />
                </div>
                <DialogHeader className="mt-4 space-y-1 text-left">
                  <DialogTitle className="text-xl font-semibold sm:text-2xl">
                    {t("anveshan.legalTitle", { defaultValue: "Terms & Privacy" })}
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    {t("anveshan.legalDescription", {
                      defaultValue: "Read both documents to the end to accept them.",
                    })}
                  </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LegalTab)} className="mt-5">
                  <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b bg-transparent p-0">
                    {(["terms", "privacy"] as const).map((tab) => (
                      <TabsTrigger
                        key={tab}
                        value={tab}
                        className="-mb-px gap-2 rounded-none border-b-2 border-transparent px-0.5 pb-3 pt-1 text-sm text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                      >
                        {hasRead(tab) ? (
                          <CircleCheck className="size-4 text-primary" aria-hidden="true" />
                        ) : tab === "terms" ? (
                          <FileText className="size-4" aria-hidden="true" />
                        ) : (
                          <ShieldCheck className="size-4" aria-hidden="true" />
                        )}
                        {legalTitle(tab, t)}
                        {hasRead(tab) && <span className="sr-only">{t("anveshan.read", { defaultValue: "(read)" })}</span>}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              {/* Reading progress for the active document */}
              <div
                className="h-1 shrink-0 bg-muted"
                role="progressbar"
                aria-label={legalTitle(activeTab, t)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(readProgress[activeTab] * 100)}
              >
                <div
                  className="h-full bg-primary transition-[width] duration-150"
                  style={{ width: `${readProgress[activeTab] * 100}%` }}
                />
              </div>

              <LegalReader
                key={activeTab}
                tab={activeTab}
                label={legalTitle(activeTab, t)}
                onProgress={handleProgress}
                endContent={
                  activeTab === "terms" && !hasRead("privacy") ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {t("anveshan.termsDone", { defaultValue: "You've reached the end of the Terms of Service." })}
                      </p>
                      <Button variant="outline" onClick={() => setActiveTab("privacy")}>
                        {t("anveshan.readPrivacyNext", { defaultValue: "Continue to Privacy Policy" })}
                        <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                      </Button>
                    </>
                  ) : (
                    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <CircleCheck className="size-4 text-primary" aria-hidden="true" />
                      {t("anveshan.docDone", { defaultValue: "You've reached the end of this document." })}
                    </p>
                  )
                }
              />

              <footer className="shrink-0 border-t bg-muted/30 px-5 py-4 sm:px-10 sm:py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    {(["terms", "privacy"] as const).map((tab) => (
                      <ConsentCheckbox
                        key={tab}
                        checked={accepted[tab]}
                        enabled={hasRead(tab)}
                        onToggle={() => toggleAccepted(tab)}
                        label={t(tab === "terms" ? "anveshan.acceptTerms" : "anveshan.acceptPrivacy", {
                          defaultValue: `I agree to the ${legalTitle(tab, t)}`,
                        })}
                      />
                    ))}
                  </div>

                  <Button size="lg" className="w-full sm:w-auto sm:min-w-44" onClick={handleSubmit} disabled={!canSubmit}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                        {t("anveshan.saving", { defaultValue: "Saving..." })}
                      </>
                    ) : (
                      t("anveshan.agreeContinue", { defaultValue: "Agree & Continue" })
                    )}
                  </Button>
                </div>

                {error && (
                  <p role="alert" className="mt-3 text-xs font-medium text-destructive">
                    {error}
                  </p>
                )}
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
