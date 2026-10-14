import { Sprout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Question } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning text-white",
  held: "bg-amber-500 text-white",
  approved: "bg-success text-white",
  rejected: "bg-destructive text-white",
  moved_to_final: "bg-[#8A2BE2] text-white",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  held: "On Hold",
  approved: "Approved",
  rejected: "Rejected",
  moved_to_final: "Published",
};

/** Anveshan questions are not reviewed in the usual way, so their pending state is not shown. */
export function isStatusHidden(question: Pick<Question, "isAnveshan" | "status">): boolean {
  return !!question.isAnveshan && question.status === "pending";
}

/** Status label shown to staff, or an empty string when the status is hidden. */
export function getStatusLabel(question: Pick<Question, "isAnveshan" | "status">): string {
  if (isStatusHidden(question)) return "";
  return STATUS_LABELS[question.status] ?? question.status;
}

interface QuestionStatusBadgeProps {
  question: Pick<Question, "isAnveshan" | "status">;
  className?: string;
}

// Small tag marking a question submitted by an Anveshan user.
export function AnveshanTag() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-emerald-600 dark:text-emerald-400">
      <Sprout className="h-3 w-3" aria-hidden="true" /> Anveshan
    </span>
  );
}

// Shows the question status, or the Anveshan tag for pending Anveshan questions.
export function QuestionStatusBadge({ question, className }: QuestionStatusBadgeProps) {
  if (isStatusHidden(question)) {
    return <AnveshanTag />;
  }
  return (
    <Badge
      className={cn(
        "whitespace-nowrap px-2 py-0.5 text-[11px] sm:text-xs",
        STATUS_COLORS[question.status] ?? "bg-muted",
        className,
      )}
    >
      {getStatusLabel(question)}
    </Badge>
  );
}
