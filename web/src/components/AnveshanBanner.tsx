import { useTranslation } from "react-i18next";
import { ArrowRight, ExternalLink, MonitorSmartphone, PenLine, Trophy, X } from "lucide-react";
import { ANVESHAN_PLATFORM_URL } from "@/constants/public";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AnveshanMilestoneBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

// Congratulates users who reached 100% and sends them to the Anveshan platform to confirm completion.
export function AnveshanMilestoneBanner({ visible, onDismiss }: AnveshanMilestoneBannerProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 border-b border-emerald-300 bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 text-white sm:gap-3 sm:px-6 sm:py-2.5",
      )}
    >
      <Trophy className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-xs font-semibold leading-snug sm:text-sm">
        <span className="sm:hidden">
          {t("anveshan.milestoneBannerShort", {
            defaultValue: "🎉 You reached 100%! Check your completion on Anveshan.",
          })}
        </span>
        <span className="hidden sm:inline">
          {t("anveshan.milestoneBanner100", {
            defaultValue:
              "🎉 Congratulations! You have reached 100%. Kindly go to the Anveshan platform and check your completion there.",
          })}
        </span>
      </p>
      <a
        href={ANVESHAN_PLATFORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-white px-2.5 text-[11px] font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600 sm:h-8 sm:px-3 sm:text-xs"
      >
        <span className="sm:hidden">{t("anveshan.goToAnveshanShort", "Anveshan")}</span>
        <span className="hidden sm:inline">{t("anveshan.goToAnveshan", "Go to Anveshan")}</span>
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">{t("common.opensInNewTab", "(opens in a new tab)")}</span>
      </a>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("common.dismiss", "Dismiss")}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/15 hover:text-white sm:h-8 sm:w-8"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

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
