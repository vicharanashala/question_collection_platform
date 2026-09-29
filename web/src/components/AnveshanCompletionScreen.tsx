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
import { ANVESHAN_PLATFORM_URL } from "@/constants/public";
import type { AnveshanMilestoneResponse } from "@/api/client";

type GoalKey = keyof AnveshanMilestoneResponse["requirements"];

const GOALS: { key: GoalKey; icon: LucideIcon; label: string }[] = [
  { key: "questions", icon: MessageSquareText, label: "Questions" },
  { key: "crop", icon: Sprout, label: "Crop" },
  { key: "weed", icon: Leaf, label: "Weed" },
  { key: "pest", icon: Bug, label: "Pest" },
  { key: "disease", icon: Microscope, label: "Disease" },
  { key: "answers", icon: PenLine, label: "Answers" },
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

  return (
    <div className="flex min-h-dvh w-full flex-col items-center overflow-y-auto bg-background bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.14),transparent_60%)] px-4 py-8 sm:justify-center sm:py-12">
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <div className="mb-5 flex items-center justify-center gap-2">
          <BrandLogo className="h-8 w-8" />
          <span className="text-sm font-bold text-foreground">AnnaDatha × Anveshan</span>
        </div>

        <Card className="overflow-hidden rounded-2xl p-0 shadow-lg">
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
                "You have completed your Anveshan milestone on AnnaDatha. Thank you for the questions, observations and answers you contributed.",
              )}
            </p>

            <div className="mt-6 flex gap-1.5" aria-hidden="true">
              {GOALS.map(({ key }, i) => (
                <motion.span
                  key={key}
                  className="h-2 flex-1 origin-left rounded-full bg-primary dark:bg-emerald-500"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 + i * 0.06, ease: "easeOut" }}
                />
              ))}
            </div>

            <ul className="mt-5 grid grid-cols-2 gap-2 text-left sm:grid-cols-3" aria-label={t("anveshanComplete.summary", "What you completed")}>
              {GOALS.map(({ key, icon: Icon, label }) => (
                <li key={key} className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-variant/40 px-2.5 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-emerald-400">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {t(`anveshanComplete.goal.${key}`, label)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums text-primary dark:text-emerald-400">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                      {milestone.requirements[key]}/{milestone.requirements[key]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 border-t border-border-subtle bg-surface-variant/30 px-6 py-5 sm:px-8">
            <p className="text-center text-sm text-muted-foreground">
              {t(
                "anveshanComplete.next",
                "Go to the Anveshan platform to check your completion and continue your journey.",
              )}
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
        </Card>
      </motion.main>

      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </div>
  );
}
