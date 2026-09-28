import { useTranslation } from "react-i18next";
import { ArrowRight, PenLine, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AnveshanMilestoneBannerProps {
  visible: boolean;
  onDismiss: () => void;
}

export function AnveshanMilestoneBanner({ visible, onDismiss }: AnveshanMilestoneBannerProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-between gap-3 border-b border-emerald-300 bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-white sm:px-6",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Trophy className="h-4 w-4 shrink-0" />
        <p className="truncate text-xs font-semibold sm:text-sm">
          {t("anveshan.milestoneBanner", {
            defaultValue: "🎉 Congratulations! You've completed your Anveshan milestone.",
          })}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("common.dismiss", "Dismiss")}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/15 hover:text-white"
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
      <p className="min-w-0 flex-1 text-xs font-semibold leading-snug text-foreground sm:text-sm">
        {/* Short copy on phones so the banner stays one or two lines. */}
        <span className="sm:hidden">
          {t("anveshan.answerTaskBannerShort", {
            answered,
            required,
            defaultValue: "80% done! Answer {{required}} of your questions ({{answered}}/{{required}})",
          })}
        </span>
        <span className="hidden sm:inline">
          {t("anveshan.answerTaskBanner", {
            answered,
            required,
            defaultValue:
              "You're 80% there! Answer {{required}} of your own questions to finish your milestone ({{answered}}/{{required}} done).",
          })}
        </span>
      </p>
      <Button size="sm" className="h-7 shrink-0 gap-1 px-2.5 sm:h-8 sm:px-3" onClick={onStart}>
        <span className="sm:hidden">{t("anveshan.answerTaskCtaShort", { defaultValue: "Answer" })}</span>
        <span className="hidden sm:inline">{t("anveshan.answerTaskCta", { defaultValue: "Start answering" })}</span>
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
