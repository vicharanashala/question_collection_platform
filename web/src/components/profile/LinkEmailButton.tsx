import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkEmailButtonProps {
  onClick: () => void;
  className?: string;
}

// Compact action shown in place of the email value until the user links one.
export function LinkEmailButton({ onClick, className }: LinkEmailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:h-7 dark:border-emerald-400/40 dark:text-emerald-300",
        className,
      )}
    >
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Link email
    </button>
  );
}
