import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
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
  ArrowRight,
  Bug,
  CheckCircle2,
  Clock,
  ExternalLink,
  Leaf,
  Lock,
  MonitorSmartphone,
  PenLine,
  MessageSquareText,
  Microscope,
  Sprout,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import type { AnveshanMilestoneResponse, AnveshanStepTimeline } from "@/api/client";
import { ANVESHAN_ANSWERS_DESKTOP_QUERY, ANVESHAN_ANSWERS_ROUTE, ANVESHAN_PLATFORM_URL } from "@/constants/public";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export type AnveshanMilestoneData = AnveshanMilestoneResponse;

export type MilestoneKey = Exclude<keyof AnveshanMilestoneData["requirements"], "answers">;


// Submissions make up the first 80% of the milestone; answering their own questions is the last 20%.
const SUBMISSION_WEIGHT = 80;
const ANSWER_WEIGHT = 100 - SUBMISSION_WEIGHT;

interface AnveshanMilestoneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AnveshanMilestoneData | null;
}

const ITEMS: { key: MilestoneKey; icon: LucideIcon; label: (n: number) => string }[] = [
  { key: "questions", icon: MessageSquareText, label: (n) => `${n} question${n === 1 ? "" : "s"} submitted` },
  { key: "crop", icon: Sprout, label: (n) => `${n} crop submission${n === 1 ? "" : "s"}` },
  { key: "weed", icon: Leaf, label: (n) => `${n} weed submission${n === 1 ? "" : "s"}` },
  { key: "pest", icon: Bug, label: (n) => `${n} pest submission${n === 1 ? "" : "s"}` },
  { key: "disease", icon: Microscope, label: (n) => `${n} disease submission${n === 1 ? "" : "s"}` },
];

const ROW_STAGGER_SECONDS = 0.07;
const RING_RADIUS = 34;

// Returns the overall completion percentage: submissions weigh 80% and answers 20%, each requirement capped.
export function getAnveshanMilestonePercent(data: AnveshanMilestoneData): number {
  const totals = ITEMS.reduce(
    (acc, { key }) => {
      const req = data.requirements[key];
      return { done: acc.done + Math.min(data.progress[key], req), required: acc.required + req };
    },
    { done: 0, required: 0 },
  );
  const submissionShare = totals.required === 0 ? 0 : totals.done / totals.required;
  const answersRequired = data.requirements.answers;
  const answerShare = answersRequired === 0 ? 1 : Math.min(data.progress.answers, answersRequired) / answersRequired;
  // Answers only count once submissions are finished, matching the order users complete them in.
  const answerPart = data.submissionsCompleted ? answerShare * ANSWER_WEIGHT : 0;
  return Math.round(submissionShare * SUBMISSION_WEIGHT + answerPart);
}

// Lists the submission goals that are not met yet, with how many more of each are needed.
export function getAnveshanRemainingSubmissions(data: AnveshanMilestoneData): { key: MilestoneKey; remaining: number }[] {
  return ITEMS.map(({ key }) => ({ key, remaining: Math.max(data.requirements[key] - data.progress[key], 0) })).filter(
    ({ remaining }) => remaining > 0,
  );
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

// Compact date and time such as "02 Sep, 10:30 am", short enough for both ends of a timeline to fit on a phone.
function formatStepTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}

// Start and completion time of one goal, shown as "start – end", with a dash until the goal is met.
function StepTimeline({ timeline }: { timeline?: AnveshanStepTimeline }) {
  const { t } = useTranslation();
  if (!timeline) return null;
  const started = formatStepTime(timeline.startedAt);
  const completed = formatStepTime(timeline.completedAt);

  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-snug text-text-tertiary">
      <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
      {started ? (
        <>
          <time dateTime={timeline.startedAt ?? undefined} title={new Date(timeline.startedAt ?? "").toLocaleString("en-IN")}>
            {started}
          </time>
          <span aria-hidden="true">–</span>
          {completed ? (
            <time dateTime={timeline.completedAt ?? undefined} title={new Date(timeline.completedAt ?? "").toLocaleString("en-IN")}>
              {completed}
            </time>
          ) : (
            <span>{t("anveshan.timelineInProgress", "—")}</span>
          )}
        </>
      ) : (
        <span>{t("anveshan.timelineNotStarted", "Not started yet")}</span>
      )}
    </p>
  );
}

interface MilestoneRowProps {
  icon: LucideIcon;
  label: string;
  progress: number;
  required: number;
  index: number;
  open: boolean;
  timeline?: AnveshanStepTimeline;
}

// One requirement row with a staggered entrance, counting progress, a filling bar and its start/end times.
function MilestoneRow({ icon: Icon, label, progress, required, index, open, timeline }: MilestoneRowProps) {
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
      <StepTimeline timeline={timeline} />
    </motion.li>
  );
}

interface AnswerTaskCardProps {
  data: AnveshanMilestoneData;
  onStart: () => void;
}

// Final milestone step: locked until submissions are done, then invites the user to answer their questions.
function AnswerTaskCard({ data, onStart }: AnswerTaskCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const required = data.requirements.answers;
  const answered = data.progress.answers;
  const done = answered >= required;
  const unlocked = data.submissionsCompleted;
  const isDesktop = useMediaQuery(ANVESHAN_ANSWERS_DESKTOP_QUERY);

  if (!unlocked) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-border-subtle px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-variant text-text-tertiary">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-secondary">
            {t("anveshan.answerTaskLockedTitle", {
              count: required,
              defaultValue: "Final step: write advisories for {{count}} farmer queries",
            })}
          </p>
          <p className="text-xs text-text-tertiary">
            {t("anveshan.answerTaskLockedHint", { defaultValue: "Unlocks after the goals above are complete." })}
          </p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-text-tertiary" aria-label={`${answered} of ${required}`}>
          {answered}/{required}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
      className={cn(
        "mt-3 rounded-xl border px-3 py-3",
        done
          ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/25"
          : "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white",
            done ? "bg-emerald-500" : "bg-primary",
          )}
        >
          {done ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <PenLine className="h-4 w-4" aria-hidden="true" />}
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
          {done
            ? t("anveshan.answerTaskDoneTitle", { count: required, defaultValue: "{{count}} advisories submitted" })
            : t("anveshan.answerTaskTitle", {
                count: required,
                defaultValue: "Final step: write advisories for {{count}} farmer queries",
              })}
        </p>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            done ? "text-emerald-700 dark:text-emerald-400" : "text-primary",
          )}
          aria-label={`${answered} of ${required}`}
        >
          {answered}/{required}
        </span>
      </div>
      <StepTimeline timeline={data.timeline?.answers} />
      {!done && (
        <>
          <p className="mt-2 text-xs leading-relaxed text-text-secondary">
            {t("anveshan.answerTaskMessage", {
              count: required,
              defaultValue:
                "Amazing work reaching 80%! You know these farmer queries best. Write an advisory, backed by a trusted source, for any {{count}} of them to complete your milestone.",
            })}
          </p>
          {isDesktop ? (
            <Button className="mt-3 w-full gap-1.5" onClick={onStart}>
              {t("anveshan.answerTaskCta", { defaultValue: "Write advisories" })}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
              <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {t("anveshan.answerTaskDesktopOnly", {
                defaultValue: "Writing advisories is available only on a desktop or laptop. Please open AnnaDatha there to finish this step.",
              })}
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}

export function AnveshanMilestoneModal({ open, onOpenChange, data }: AnveshanMilestoneModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const percent = data ? getAnveshanMilestonePercent(data) : 0;
  const submissionGoalsMet = data ? ITEMS.filter(({ key }) => data.progress[key] >= data.requirements[key]).length : 0;
  const answerGoalMet = data?.submissionsCompleted && data.progress.answers >= data.requirements.answers ? 1 : 0;
  const goalsMet = submissionGoalsMet + answerGoalMet;

  // Closes the modal and opens the page where users answer their own questions.
  const startAnswering = () => {
    onOpenChange(false);
    navigate(ANVESHAN_ANSWERS_ROUTE);
  };

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
                    total: ITEMS.length + 1,
                    defaultValue: "{{met}} of {{total}} goals complete",
                  })}
                </p>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {data.completed
                    ? t("anveshan.allGoalsDone", { defaultValue: "Every requirement is met." })
                    : data.submissionsCompleted
                      ? t("anveshan.answerToFinish", { defaultValue: "Write advisories for farmer queries to reach 100%." })
                      : t("anveshan.keepGoing", { defaultValue: "Keep submitting to reach 80%, then write advisories to finish." })}
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
                  timeline={data.timeline?.[key]}
                />
              ))}
            </ul>

            <AnswerTaskCard data={data} onStart={startAnswering} />
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
            <p>
              {t("anveshan.milestoneComplete100", {
                defaultValue: "🎉 Congratulations! You have reached 100%. Kindly go to the Anveshan platform and check your completion there.",
              })}
            </p>
            <Button asChild size="sm" className="mt-3 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
              <a href={ANVESHAN_PLATFORM_URL} target="_blank" rel="noopener noreferrer">
                {t("anveshan.goToAnveshan", "Go to Anveshan")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="sr-only">{t("common.opensInNewTab", "(opens in a new tab)")}</span>
              </a>
            </Button>
          </motion.div>
        )}

        <Button className="mt-4 w-full" variant="outline" onClick={() => onOpenChange(false)}>
          {t("common.close", "Close")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
