import { BadgeCheck } from "lucide-react";

// Shows a linked email with a verified badge. Emails are only stored once verified.
export function VerifiedEmail({ email }: { email: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <span className="truncate">{email}</span>
      <BadgeCheck
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
      />
      <span className="sr-only">Verified</span>
    </span>
  );
}
