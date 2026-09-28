import { useTranslation } from "react-i18next";
import { Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";

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