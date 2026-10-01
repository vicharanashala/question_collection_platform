import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Bug,
  Check,
  ExternalLink,
  Leaf,
  LogOut,
  MessageSquareHeart,
  MessageSquareText,
  Microscope,
  PenLine,
  Sprout,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/BrandLogo";
import { SignOutDialog } from "@/components/SignOutDialog";
import { JOURNEY, JourneyStep } from "@/components/AnveshanJourney";
import { StepTimeline } from "@/pages/public/AnveshMileStone";
import { ANVESHAN_PLATFORM_URL } from "@/constants/public";
import type { AnveshanMilestoneResponse } from "@/api/client";

type GoalKey = keyof AnveshanMilestoneResponse["requirements"];

// Document upload happens on the Anveshan platform, so it stays pending here even after the milestone is complete.
const PENDING_PHASE_ID = "documents";
const COMPLETED_PHASES = JOURNEY.filter((phase) => phase.id !== PENDING_PHASE_ID).length;

const GOALS: { key: GoalKey; icon: LucideIcon; label: string }[] = [
  { key: "questions", icon: MessageSquareText, label: "Questions" },
  { key: "crop", icon: Sprout, label: "Crop" },
  { key: "weed", icon: Leaf, label: "Weed" },
  { key: "pest", icon: Bug, label: "Pest" },
  { key: "disease", icon: Microscope, label: "Disease" },
  { key: "answers", icon: PenLine, label: "Advisories" },
];

interface AnveshanCompletionScreenProps {
  milestone: AnveshanMilestoneResponse;
  userName?: string | null;
  onShareFeedback: () => void;
}

// Full-page screen shown to Anveshan users at 100%; it replaces the rest of the app for them.
export function AnveshanCompletionScreen({ milestone, userName, onShareFeedback }: AnveshanCompletionScreenProps) {
  const { t } = useTranslation();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const firstName = userName?.trim().split(/\s+/)[0];

  const actions = (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground">
        {t("anveshanComplete.next", "Your last step is to upload your documents on the Anveshan platform.")}
      </p>
      <Button className="w-full gap-2" asChild>
        <a href={ANVESHAN_PLATFORM_URL} target="_blank" rel="noopener noreferrer">
          {t("anveshan.goToAnveshan", "Go to Anveshan")}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t("common.opensInNewTab", "(opens in a new tab)")}</span>
        </a>
      </Button>
      {milestone.feedbackSubmitted ? (
        <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary dark:text-emerald-400" role="status">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {t("anveshanComplete.feedbackThanks", "Thanks for sharing your feedback!")}
        </p>
      ) : (
        <Button variant="outline" className="w-full gap-2" onClick={onShareFeedback}>
          <MessageSquareHeart className="h-4 w-4" aria-hidden="true" />
          {t("anveshanComplete.shareFeedback", "Share your feedback")}
        </Button>
      )}
      <div className="flex justify-center pt-1">
        <Button variant="link" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setSignOutOpen(true)}>
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          {t("common.signOut", "Sign out")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh w-full flex-col items-center overflow-y-auto bg-background bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.14),transparent_60%)] px-4 py-8 sm:justify-center sm:py-12">
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-lg lg:max-w-5xl"
      >
        <div className="mb-5 flex items-center justify-center gap-2">
          <BrandLogo className="h-8 w-8" />
          <span className="text-sm font-bold text-foreground">AnnaDatha × Anveshan</span>
        </div>

        <Card className="overflow-hidden rounded-2xl p-0 shadow-lg lg:grid lg:grid-cols-2">
          {/* Congratulations and milestone summary; actions sit here on desktop */}
          <div className="flex flex-col lg:border-r lg:border-border-subtle">
            <div className="px-6 pb-6 pt-8 text-center sm:px-8">
              <motion.div
                initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.1 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/40"
              >
                <Trophy className="h-8 w-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </motion.div>

              <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-primary dark:text-emerald-400">
                {t("anveshanComplete.eyebrow", "Milestone complete · 100%")}
              </p>
              <h1 className="mt-2 text-2xl font-bold leading-tight text-foreground">
                {firstName
                  ? t("anveshanComplete.titleNamed", { name: firstName, defaultValue: "Congratulations, {{name}}!" })
                  : t("anveshanComplete.title", "Congratulations!")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(
                  "anveshanComplete.description",
                  "You have completed your Anveshan milestone on AnnaDatha. Thank you for the questions, observations and advisories you contributed.",
                )}
              </p>

              <p className="mt-6 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("anveshanComplete.milestoneHeading", "AnnaDatha milestone")}
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-2 text-left sm:grid-cols-2" aria-label={t("anveshanComplete.summary", "What you completed")}>
                {GOALS.map(({ key, icon: Icon, label }) => (
                  <li key={key} className="flex items-start gap-2 rounded-lg border border-border-subtle bg-surface-variant/40 px-2.5 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-emerald-400">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-foreground">
                          {t(`anveshanComplete.goal.${key}`, label)}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums text-primary dark:text-emerald-400">
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                          {milestone.requirements[key]}/{milestone.requirements[key]}
                        </span>
                      </div>
                      <StepTimeline timeline={milestone.timeline?.[key]} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto hidden border-t border-border-subtle bg-surface-variant/30 px-6 py-5 sm:px-8 lg:block">{actions}</div>
          </div>

          {/* Anveshan journey: everything up to Ground Truth Module is complete; documents are uploaded on Anveshan. */}
          <section
            aria-labelledby="anveshan-journey-heading"
            className="border-t border-border-subtle px-5 py-6 sm:px-6 lg:border-t-0 lg:bg-surface-variant/20 lg:py-8"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 id="anveshan-journey-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("anveshanComplete.journeyHeading", "Your Anveshan journey")}
              </h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary dark:text-emerald-400">
                {t("anveshanComplete.journeyDone", {
                  done: COMPLETED_PHASES,
                  total: JOURNEY.length,
                  defaultValue: "{{done}}/{{total}} done",
                })}
              </span>
            </div>
            <ol className="space-y-2">
              {JOURNEY.map((phase) =>
                phase.id === PENDING_PHASE_ID ? (
                  <JourneyStep
                    key={phase.id}
                    phase={phase}
                    status="current"
                    badgeLabel={t("anveshanComplete.pending", "Pending")}
                    description={t("anveshanComplete.documentsPending", "Complete this on the Anveshan platform.")}
                  />
                ) : (
                  <JourneyStep key={phase.id} phase={phase} status="done" />
                ),
              )}
            </ol>
          </section>

          <div className="border-t border-border-subtle bg-surface-variant/30 px-6 py-5 sm:px-8 lg:hidden">{actions}</div>
        </Card>
      </motion.main>

      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </div>
  );
}
