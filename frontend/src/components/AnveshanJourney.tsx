import {
  BookOpen,
  Check,
  ClipboardList,
  FileUp,
  MessageSquareText,
  Sprout,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface JourneyPhase {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export type PhaseStatus = "done" | "current" | "unlock" | "upcoming";

// Candidate journey in the order stored in the Anveshan `current_phase` field.
export const JOURNEY: JourneyPhase[] = [
  { id: "onboarding", label: "Onboarding", description: "Register and set up your Anveshan profile.", icon: UserPlus },
  { id: "interview", label: "Start Interview", description: "AI interview on domain knowledge and communication.", icon: MessageSquareText },
  { id: "summary", label: "Interview Summary", description: "Review your interview results and feedback.", icon: ClipboardList },
  { id: "foundation", label: "Foundation Course", description: "Complete the agriculture advisory course.", icon: BookOpen },
  { id: "module", label: "Ground Truth Module", description: "Collect real farmer questions on AnnaDatha.", icon: Sprout },
  { id: "documents", label: "Upload Documents", description: "Submit your documents for verification.", icon: FileUp },
];

const STATUS_BADGE: Record<PhaseStatus, string> = {
  done: "Done",
  current: "Now",
  unlock: "Unlocks",
  upcoming: "Soon",
};

interface JourneyStepProps {
  phase: JourneyPhase;
  status: PhaseStatus;
  /** Replaces the default badge text for the status, e.g. "Pending". */
  badgeLabel?: string;
  /** Replaces the phase's default description. */
  description?: string;
}

// One row of the journey list: status icon, label, description and status badge.
export function JourneyStep({ phase, status, badgeLabel, description = phase.description }: JourneyStepProps) {
  const Icon = phase.icon;
  return (
    <li
      aria-current={status === "current" ? "step" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5",
        status === "done" && "border-border-subtle bg-surface",
        status === "current" && "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20",
        status === "unlock" && "border-dashed border-primary/50 bg-primary/5",
        status === "upcoming" && "border-border-subtle bg-surface-variant/30",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          status === "done" && "bg-primary text-primary-foreground",
          status === "current" && "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
          status === "unlock" && "bg-primary/10 text-primary dark:text-emerald-400",
          status === "upcoming" && "bg-muted text-muted-foreground",
        )}
      >
        {status === "done" ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", status === "upcoming" ? "text-muted-foreground" : "text-foreground")}>
          {phase.label}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={description}>
          {description}
        </p>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
          (status === "done" || status === "unlock") && "bg-primary/10 text-primary dark:text-emerald-400",
          status === "current" && "bg-amber-500 text-white",
          status === "upcoming" && "text-muted-foreground",
        )}
      >
        {badgeLabel ?? STATUS_BADGE[status]}
      </span>
    </li>
  );
}
