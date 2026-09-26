import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnveshanMilestoneData {
  requirements: { questions: number; crop: number; weed: number; pest: number; disease: number };
  progress: { questions: number; crop: number; weed: number; pest: number; disease: number };
  completed: boolean;
}

interface AnveshanMilestoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AnveshanMilestoneData | null;
}

const ITEMS: Array<{ key: keyof AnveshanMilestoneData["requirements"]; label: (n: number) => string }> = [
  { key: "questions", label: (n) => `${n} question${n === 1 ? "" : "s"} submitted` },
  { key: "crop", label: (n) => `${n} crop submission${n === 1 ? "" : "s"}` },
  { key: "weed", label: (n) => `${n} weed submission${n === 1 ? "" : "s"}` },
  { key: "pest", label: (n) => `${n} pest submission${n === 1 ? "" : "s"}` },
  { key: "disease", label: (n) => `${n} disease submission${n === 1 ? "" : "s"}` },
];

export function AnveshanMilestoneModal({ open, onOpenChange, data }: AnveshanMilestoneModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 sm:p-8">
        <DialogHeader className="items-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <Trophy className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <DialogTitle className="text-center">
            {t("anveshan.milestoneTitle", { defaultValue: "Your Progress" })}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t("anveshan.milestoneDescription", {
              defaultValue: "Complete all requirements below to finish your milestone.",
            })}
          </DialogDescription>
        </DialogHeader>

        {data && (
          <div className="mt-2 space-y-2">
            {ITEMS.map(({ key, label }) => {
              const req = data.requirements[key];
              const prog = data.progress[key];
              const done = prog >= req;
              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors",
                    done
                      ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20"
                      : "border-border-subtle bg-surface",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-text-tertiary" />
                    )}
                    <span className={cn("text-sm font-medium", done ? "text-foreground" : "text-text-secondary")}>
                      {label(req)}
                    </span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-text-tertiary">
                    {prog}/{req}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {data?.completed && (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
            {t("anveshan.milestoneComplete", { defaultValue: "🎉 Milestone complete! Great work." })}
          </div>
        )}

        <Button className="mt-4 w-full" variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.close", "Close")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}