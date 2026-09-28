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
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-primary/30 bg-primary/10 px-4 py-2.5 sm:px-6"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <PenLine className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs font-semibold text-foreground sm:text-sm">
          {t("anveshan.answerTaskBanner", {
            answered,
            required,
            defaultValue:
              "You're 80% there! Answer {{required}} of your own questions to finish your milestone ({{answered}}/{{required}} done).",
          })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" className="gap-1" onClick={onStart}>
          {t("anveshan.answerTaskCta", { defaultValue: "Start answering" })}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("common.dismiss", "Dismiss")}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-variant hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
