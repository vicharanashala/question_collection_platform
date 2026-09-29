import { useTranslation } from "react-i18next";
import { ArrowRight, MonitorSmartphone, PenLine, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MilestoneKey } from "@/pages/public/AnveshMileStone";

interface AnveshanAnswerTaskBannerProps {
  visible: boolean;
  answered: number;
  required: number;
  onStart: () => void;
  onDismiss: () => void;
}

// Encourages Anveshan users who finished their submissions to take on the final answering step.
export function AnveshanAnswerTaskBanner({ visible, answered, required, onStart, onDismiss }: AnveshanAnswerTaskBannerProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-primary/30 bg-primary/10 px-3 py-2 sm:gap-3 sm:px-6 sm:py-2.5"
    >
      <PenLine className="hidden h-4 w-4 shrink-0 text-primary sm:block" aria-hidden="true" />
      <MonitorSmartphone className="h-4 w-4 shrink-0 text-amber-600 sm:hidden dark:text-amber-400" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-xs font-semibold leading-snug text-foreground sm:text-sm">
        {/* Answering is desktop-only, so smaller screens are told where to finish instead of getting a button. */}
        <span className="lg:hidden">
          {t("anveshan.answerTaskBannerMobile", {
            answered,
            required,
            defaultValue: "80% done! Open AnnaDatha on a desktop or laptop to answer {{required}} of your questions ({{answered}}/{{required}}).",
          })}
        </span>
        <span className="hidden lg:inline">
          {t("anveshan.answerTaskBanner", {
            answered,
            required,
            defaultValue:
              "You're 80% there! Answer {{required}} of your own questions to finish your milestone ({{answered}}/{{required}} done).",
          })}
        </span>
      </p>
      <Button size="sm" className="hidden h-8 shrink-0 gap-1 px-3 lg:inline-flex" onClick={onStart}>
        {t("anveshan.answerTaskCta", { defaultValue: "Start answering" })}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("common.dismiss", "Dismiss")}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-variant hover:text-foreground sm:h-8 sm:w-8"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface AnveshanProgressBannerProps {
  visible: boolean;
  percent: number;
  remaining: { key: MilestoneKey; remaining: number }[];
  onViewDetails: () => void;
  onDismiss: () => void;
}

type Translate = ReturnType<typeof useTranslation>["t"];

// Short label for one unmet goal, such as "16 questions" or "1 weed".
function remainingLabel(key: MilestoneKey, count: number, t: Translate): string {
  if (key === "questions") {
    return t("anveshan.progressRemainingQuestions", {
      count,
      defaultValue: count === 1 ? "{{count}} question" : "{{count}} questions",
    });
  }
  return t(`anveshan.progressRemaining.${key}`, { count, defaultValue: `{{count}} ${key}` });
}

// Shows Anveshan users their milestone progress and what is left before answering unlocks.
export function AnveshanProgressBanner({ visible, percent, remaining, onViewDetails, onDismiss }: AnveshanProgressBannerProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  const remainingText = remaining.map(({ key, remaining: count }) => remainingLabel(key, count, t)).join(" · ");

  return (
    <div
      role="status"
      className="relative flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 sm:gap-3 sm:px-6 sm:py-2.5"
    >
      <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
        <Target className="h-4 w-4" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5 text-xs font-semibold leading-snug text-foreground sm:text-sm">
          <span className="truncate">{t("anveshan.progressBannerTitle", "Your Anveshan milestone")}</span>
          <span className="shrink-0 tabular-nums text-primary dark:text-emerald-400">{percent}%</span>
        </p>
        {remainingText && (
          <p className="line-clamp-2 text-[11px] leading-snug text-text-secondary sm:line-clamp-none sm:truncate sm:text-xs">
            {t("anveshan.progressBannerRemaining", {
              items: remainingText,
              defaultValue: "Left to unlock answering: {{items}}",
            })}
          </p>
        )}
      </div>

      <Button variant="outline" size="sm" className="h-7 shrink-0 gap-1 px-2.5 text-[11px] sm:h-8 sm:px-3 sm:text-xs" onClick={onViewDetails}>
        {t("anveshan.progressBannerDetails", "Details")}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("common.dismiss", "Dismiss")}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-variant hover:text-foreground sm:h-8 sm:w-8"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Thin progress line along the bottom edge of the banner. */}
      <div
        className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/10"
        role="progressbar"
        aria-label={t("anveshan.progressBannerTitle", "Your Anveshan milestone")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full bg-primary transition-[width] duration-500 dark:bg-emerald-400" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
