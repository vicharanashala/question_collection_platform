import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Bug,
  CheckCircle2,
  Leaf,
  MessageSquareText,
  Microscope,
  Sprout,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

export interface AnveshanMilestoneData {
  requirements: { questions: number; crop: number; weed: number; pest: number; disease: number };
  progress: { questions: number; crop: number; weed: number; pest: number; disease: number };
  completed: boolean;
}

type MilestoneKey = keyof AnveshanMilestoneData["requirements"];

interface AnveshanMilestoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AnveshanMilestoneData | null;
}

const ITEMS: Array<{ key: MilestoneKey; icon: LucideIcon; label: (n: number) => string }> = [
  { key: "questions", icon: MessageSquareText, label: (n) => `${n} question${n === 1 ? "" : "s"} submitted` },
  { key: "crop", icon: Sprout, label: (n) => `${n} crop submission${n === 1 ? "" : "s"}` },
  { key: "weed", icon: Leaf, label: (n) => `${n} weed submission${n === 1 ? "" : "s"}` },
  { key: "pest", icon: Bug, label: (n) => `${n} pest submission${n === 1 ? "" : "s"}` },
  { key: "disease", icon: Microscope, label: (n) => `${n} disease submission${n === 1 ? "" : "s"}` },
];

const ROW_STAGGER_SECONDS = 0.07;
const RING_RADIUS = 34;

// Returns the overall completion percentage, capping each requirement so extra submissions do not over-count.
function overallPercent(data: AnveshanMilestoneData): number {
  const totals = ITEMS.reduce(
    (acc, { key }) => {
      const req = data.requirements[key];
      return { done: acc.done + Math.min(data.progress[key], req), required: acc.required + req };
    },
    { done: 0, required: 0 },
  );
  return totals.required === 0 ? 0 : Math.round((totals.done / totals.required) * 100);
}

interface ProgressRingProps {
  percent: number;
  open: boolean;
}

// Circular overall progress indicator with an animated stroke and counting percentage.
function ProgressRing({ percent, open }: ProgressRingProps) {
  const reduceMotion = useReducedMotion();
  const shownPercent = useCountUp(percent, { active: open, duration: 1.1, delay: 0.15 });
  const fraction = percent / 100;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={RING_RADIUS} className="fill-none stroke-border-subtle" strokeWidth="7" />
        <motion.circle
          cx="40"
          cy="40"
          r={RING_RADIUS}
          className="fill-none stroke-emerald-500"
          strokeWidth="7"
          strokeLinecap="round"
          initial={{ pathLength: reduceMotion ? fraction : 0 }}
          animate={{ pathLength: fraction }}
          transition={{ duration: reduceMotion ? 0 : 1.1, delay: 0.15, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums text-foreground">{shownPercent}%</span>
      </div>
    </div>
  );
}

interface MilestoneRowProps {
  icon: LucideIcon;
  label: string;
  progress: number;
  required: number;
  index: number;
  open: boolean;
}

// One requirement row with a staggered entrance, counting progress and a filling bar.
function MilestoneRow({ icon: Icon, label, progress, required, index, open }: MilestoneRowProps) {
  const reduceMotion = useReducedMotion();
  const delay = 0.2 + index * ROW_STAGGER_SECONDS;
  const shownProgress = useCountUp(progress, { active: open, duration: 0.8, delay });
  const done = progress >= required;
  const fillPercent = required === 0 ? 100 : Math.min(100, (progress / required) * 100);

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduceMotion ? 0 : delay, ease: "easeOut" }}
      className={cn(
        "rounded-xl border px-3 py-2.5 transition-colors",
        done
          ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/25"
          : "border-border-subtle bg-surface",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            done
              ? "bg-emerald-500 text-white"
              : "bg-surface-variant text-text-secondary",
          )}
        >
          {done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
        </span>
        <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", done ? "text-foreground" : "text-text-secondary")}>
          {label}
        </span>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            done ? "text-emerald-700 dark:text-emerald-400" : "text-text-tertiary",
          )}
          aria-label={`${progress} of ${required}`}
        >
          {shownProgress}/{required}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border-subtle" aria-hidden="true">
        <motion.div
          className={cn("h-full rounded-full", done ? "bg-emerald-500" : "bg-amber-500")}
          initial={{ width: reduceMotion ? `${fillPercent}%` : "0%" }}
          animate={{ width: `${fillPercent}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.8, delay: reduceMotion ? 0 : delay, ease: "easeOut" }}
        />
      </div>
    </motion.li>
  );
}

export function AnveshanMilestoneModal({ open, onOpenChange, data }: AnveshanMilestoneModalProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const percent = data ? overallPercent(data) : 0;
  const goalsMet = data ? ITEMS.filter(({ key }) => data.progress[key] >= data.requirements[key]).length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-md sm:p-7">
        <DialogHeader className="items-center space-y-2">
          <motion.div
            initial={reduceMotion ? false : { scale: 0.4, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40"
          >
            <Trophy className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          </motion.div>
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
          <>
            <div className="mt-3 flex items-center gap-4 rounded-xl border border-border-subtle bg-surface-variant/40 p-3">
              <ProgressRing percent={percent} open={open} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {t("anveshan.goalsMet", {
                    met: goalsMet,
                    total: ITEMS.length,
                    defaultValue: "{{met}} of {{total}} goals complete",
                  })}
                </p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {data.completed
                    ? t("anveshan.allGoalsDone", { defaultValue: "Every requirement is met." })
                    : t("anveshan.keepGoing", { defaultValue: "Keep submitting to reach 100%." })}
                </p>
              </div>
            </div>

            <ul className="mt-3 space-y-2">
              {ITEMS.map(({ key, icon, label }, index) => (
                <MilestoneRow
                  key={key}
                  icon={icon}
                  label={label(data.requirements[key])}
                  progress={data.progress[key]}
                  required={data.requirements[key]}
                  index={index}
                  open={open}
                />
              ))}
            </ul>
          </>
        )}

        {data?.completed && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18, delay: reduceMotion ? 0 : 0.7 }}
            className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
            role="status"
          >
            {t("anveshan.milestoneComplete", { defaultValue: "🎉 Milestone complete! Great work." })}
          </motion.div>
        )}

        <Button className="mt-4 w-full" variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.close", "Close")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
