import { useState } from "react";
import { AlertCircle, Check, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorMessage } from "@/api/client";
import {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  userRoleApi,
  type AssignableRole,
} from "@/api/userRole";

const MAX_REASON_LENGTH = 500;

interface ChangeRoleButtonProps {
  userId: string;
  userName: string;
  /** The user's current role, e.g. "curator". */
  currentRole: string;
  /** Called after the role was changed, so the page can refetch. */
  onChanged?: () => void | Promise<void>;
}

function roleLabel(role: string) {
  return ROLE_LABELS[role as AssignableRole] ?? role.replace(/_/g, " ");
}

/**
 * Super admin control to switch a user's role to admin, curator, distributor
 * or finance. Renders its own button and confirmation dialog.
 */
export function ChangeRoleButton({
  userId,
  userName,
  currentRole,
  onChanged,
}: ChangeRoleButtonProps) {
  const [open, setOpen] = useState(false);
  const [newRole, setNewRole] = useState<AssignableRole | "">("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    if (saving) return;
    setOpen(next);
    if (!next) {
      setNewRole("");
      setReason("");
    }
  }

  async function handleConfirm() {
    if (!newRole) return;
    setSaving(true);
    try {
      await userRoleApi.changeRole(userId, {
        role: newRole,
        reason: reason.trim() || undefined,
      });
      toast.success(
        `${userName || "User"} is now ${roleLabel(newRole)}. They were logged out and must sign in again.`,
      );
      setOpen(false);
      setNewRole("");
      setReason("");
      await onChanged?.();
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to change role"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <UserCog className="h-4 w-4" /> Change role
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border-subtle shrink-0">
            <DialogTitle className="text-sm sm:text-base font-semibold">
              Change role
            </DialogTitle>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
              {userName || "This user"} is currently{" "}
              <span className="font-semibold">{roleLabel(currentRole)}</span>.
              Choose the role they should have from now on.
            </p>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="change-role-select">New role</Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as AssignableRole)}
              >
                <SelectTrigger id="change-role-select">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.map((r) => {
                    const isCurrent = r === currentRole;
                    return (
                      <SelectItem
                        key={r}
                        value={r}
                        disabled={isCurrent}
                        className={isCurrent ? "text-muted-foreground" : undefined}
                      >
                        {isCurrent && (
                          <Check
                            aria-hidden="true"
                            className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2"
                          />
                        )}
                        {ROLE_LABELS[r]}
                        {isCurrent && (
                          <span className="ml-2 text-[10px] font-medium uppercase tracking-wide">
                            Current
                          </span>
                        )}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="change-role-reason">
                Reason{" "}
                <span className="text-muted-foreground font-normal">
                  (optional, saved in the audit log)
                </span>
              </Label>
              <textarea
                id="change-role-reason"
                rows={3}
                maxLength={MAX_REASON_LENGTH}
                className="w-full rounded-lg border border-border-subtle bg-background px-3 py-2 text-xs sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus focus:border-focus placeholder:text-muted-foreground"
                placeholder="Why is this role changing?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] sm:text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                The user is logged out right away and gets the new role when
                they sign in again.
              </span>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border-subtle shrink-0 gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!newRole || saving}>
              {saving ? "Saving..." : "Change role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
