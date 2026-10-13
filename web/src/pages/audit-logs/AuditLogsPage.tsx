import { useCallback, useEffect, useState } from "react";
import { auditApi, getErrorMessage } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangeFilter } from "@/components/DateRange-Filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Grid3X3,
  List,
  ScrollText,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { formatDateTime } from "@/lib/utils";
import type { DateRange } from "@daypicker/react";
import type { AuditLogEntry, AuditLogQuery, AuditLogsResponse } from "@/types";
import { useAuth } from "@/context/AuthContext";

const PAGE_SIZE = 50;
type ViewMode = "list" | "grid";

const AUDIT_ACTIONS = [
  "user_suspended",
  "user_banned",
  "user_unsuspended",
  "user_unbanned",
  "user_verified",
  "user_created",
  "config_updated",
  "question_approved",
  "question_rejected",
  "question_distributed",
  "hold_question",
  "request_info",
  "report_replied",
  "update_report",
  "report_status_changed",
  "create_faq",
  "update_faq",
  "delete_faq",
  "translate_question",
] as const;

const POSITIVE_ACTIONS = new Set([
  "user_unsuspended",
  "user_unbanned",
  "user_verified",
  "user_created",
  "question_approved",
  "create_faq",
]);
const DESTRUCTIVE_ACTIONS = new Set([
  "user_suspended",
  "user_banned",
  "question_rejected",
  "delete_faq",
]);

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super admin" },
  { value: "admin", label: "Admin" },
  { value: "curator", label: "Curator" },
  { value: "finance", label: "Finance" },
  { value: "distributor", label: "Distributor" },
] as const;

function prettify(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function actionVariant(action: string): "success" | "destructive" | "warning" {
  if (POSITIVE_ACTIONS.has(action)) return "success";
  if (DESTRUCTIVE_ACTIONS.has(action)) return "destructive";
  return "warning";
}

function valueLabel(value: unknown): string {
  if (value === null || value === undefined) return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object")
    return Array.isArray(value) ? value.join(", ") : "View details";
  return String(value);
}

function KeyValueFields({
  value,
  compact = false,
}: {
  value: Record<string, unknown> | null | undefined;
  compact?: boolean;
}) {
  const entries = Object.entries(value ?? {});
  if (!entries.length)
    return <p className="text-xs text-text-tertiary">No details recorded.</p>;
  return (
    <dl
      className={
        compact
          ? "grid gap-x-4 gap-y-2 sm:grid-cols-2"
          : "grid gap-x-5 gap-y-3 sm:grid-cols-2"
      }
    >
      {entries.map(([key, fieldValue]) => (
        <div key={key} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            {prettify(key)}
          </dt>
          {fieldValue &&
          typeof fieldValue === "object" &&
          !Array.isArray(fieldValue) ? (
            <dd className="mt-1 rounded-md border border-border-subtle bg-surface-variant p-2">
              <KeyValueFields
                value={fieldValue as Record<string, unknown>}
                compact
              />
            </dd>
          ) : (
            <dd className="mt-0.5 break-words text-sm text-text-secondary">
              {valueLabel(fieldValue)}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

function DetailBlock({
  title,
  value,
  className = "",
}: {
  title: string;
  value: Record<string, unknown> | null | undefined;
  className?: string;
}) {
  return (
    <section className={className}>
      <h3 className="mb-3 text-sm font-semibold text-text">{title}</h3>
      <KeyValueFields value={value} />
    </section>
  );
}

function EntryDetails({ entry }: { entry: AuditLogEntry }) {
  const actorDetails = {
    actor: entry.actor?.name ?? entry.actor?.id ?? "System",
    role: entry.actor?.actorType ? prettify(entry.actor.actorType) : null,
    actorId: entry.actor?.id,
    requestId: entry.resource?.requestId,
    ipAddress: entry.resource?.ipAddress,
  };
  return (
    <div className="space-y-5 border-t border-border-subtle pt-4">
      <DetailBlock title="Audit information" value={actorDetails} />
      <DetailBlock title="Context" value={entry.context} />
      <section>
        <h3 className="mb-3 text-sm font-semibold text-text">Changes</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border-subtle p-3">
            <p className="mb-3 text-xs font-medium text-text-tertiary">
              Before
            </p>
            <KeyValueFields value={entry.changes?.before} compact />
          </div>
          <div className="rounded-lg border border-border-subtle p-3">
            <p className="mb-3 text-xs font-medium text-text-tertiary">After</p>
            <KeyValueFields value={entry.changes?.after} compact />
          </div>
        </div>
      </section>
      {entry.outcome && (
        <DetailBlock
          title="Outcome details"
          value={entry.outcome as Record<string, unknown>}
        />
      )}
    </div>
  );
}

function EntryHeading({ entry }: { entry: AuditLogEntry }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={actionVariant(entry.actionType)}>
            {prettify(entry.actionType)}
          </Badge>
          <span className="font-medium text-text">
            {entry.actor?.name ?? entry.actor?.id ?? "System"}
          </span>
          {entry.actor?.actorType && (
            <span className="text-xs text-text-tertiary">
              {prettify(entry.actor.actorType)}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-left sm:text-right">
        <p className="text-xs text-text-secondary">
          {formatDateTime(entry.createdAt) ?? entry.createdAt}
        </p>
        <p className="mt-1 text-xs text-text-tertiary">
          {prettify(entry.outcome?.status ?? "unknown outcome")}
        </p>
      </div>
    </div>
  );
}

function ListEntry({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="px-5 py-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        <EntryHeading entry={entry} />
        <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
          {expanded ? "Hide details" : "View details"}
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>
      {expanded && <EntryDetails entry={entry} />}
    </article>
  );
}

function GridEntry({
  entry,
  expanded,
  onToggle,
}: {
  entry: AuditLogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="shadow-xs">
      <CardContent className="p-4">
        <EntryHeading entry={entry} />
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {expanded ? "Hide details" : "View details"}
            {expanded ? (
              <ChevronUp className="ml-1 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-1 h-4 w-4" />
            )}
          </Button>
        </div>
        {expanded && (
          <div className="mt-4">
            <EntryDetails entry={entry} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AuditLogsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const canUseFilters = isSuperAdmin || user?.role === "admin";

  // Admins don't get the super admin option
  const roleOptions = ROLE_OPTIONS.filter(
    (option) => isSuperAdmin || option.value !== "super_admin",
  );

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("list");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<AuditLogQuery>({
    page: 1,
    limit: PAGE_SIZE,
    sortBy: "createdAt",
    sortOrder: "DESC",
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response: AuditLogsResponse = await auditApi.getAuditLogs(filters);
      setLogs(response.data);
      setTotal(response.total);
      setPage(response.page);
      setTotalPages(response.totalPages);
      setExpandedIds(new Set());
    } catch (error) {
      toast.error(
        `Failed to load audit logs: ${getErrorMessage(error, "Unknown error")}`,
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);
  function updateFilters(update: Partial<AuditLogQuery>) {
    setFilters((current) => ({ ...current, ...update, page: 1 }));
  }
  function handleDateRangeChange(range: DateRange | undefined) {
    updateFilters({
      fromDate: range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
      toDate: range?.to ? format(range.to, "yyyy-MM-dd") : undefined,
    });
  }
  function toggleEntry(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  const hasFilters = Boolean(
    filters.search ||
    filters.role ||
    filters.actionType ||
    filters.fromDate ||
    filters.toDate,
  );
  const visibleFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const visibleTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold text-text sm:text-2xl">
          <ScrollText className="h-6 w-6" />
          Audit Logs
        </h1>
        <p className="mt-0.5 text-sm text-text-secondary">
          {canUseFilters
            ? "A chronological record of administrative and curator actions."
            : "A record of your own actions."}
        </p>
      </header>
      <Card className="shadow-xs">
        <CardContent
          className={`grid gap-4 p-4 md:grid-cols-2 ${
            canUseFilters ? "xl:grid-cols-5" : "xl:grid-cols-3"
          }`}
        >
          <div className="xl:col-span-2">
            <Label htmlFor="audit-search" className="text-xs">
              Search actor name or email
            </Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-tertiary" />
              <Input
                id="audit-search"
                className="pl-9"
                placeholder="Search audit logs"
                value={filters.search ?? ""}
                onChange={(event) =>
                  updateFilters({ search: event.target.value || undefined })
                }
              />
            </div>
          </div>
          {canUseFilters && (
            <>
              <div>
                <Label className="text-xs">Actor role</Label>
                <Select
                  value={filters.role ?? "all"}
                  onValueChange={(role) =>
                    updateFilters({ role: role === "all" ? undefined : role })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="super_admin">Super admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="curator">Curator</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="distributor">Distributor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Action type</Label>
                <Select
                  value={filters.actionType ?? "all"}
                  onValueChange={(actionType) =>
                    updateFilters({
                      actionType: actionType === "all" ? undefined : actionType,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {AUDIT_ACTIONS.map((action) => (
                      <SelectItem key={action} value={action}>
                        {prettify(action)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <DateRangeFilter
            value={{
              from: filters.fromDate ? parseISO(filters.fromDate) : undefined,
              to: filters.toDate ? parseISO(filters.toDate) : undefined,
            }}
            onChange={handleDateRangeChange}
          />
          {hasFilters && (
            <div className="col-span-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters({
                    page: 1,
                    limit: PAGE_SIZE,
                    sortBy: "createdAt",
                    sortOrder: "DESC",
                  })
                }
              >
                <X className="mr-1 h-4 w-4" />
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <section aria-label="Audit log entries">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {loading
                ? "Loading entries…"
                : `${total.toLocaleString()} ${total === 1 ? "entry" : "entries"}`}
            </p>
            <p className="mt-0.5 text-xs text-text-tertiary">Newest first</p>
          </div>
          <div
            className="flex rounded-md border border-border-subtle p-1"
            aria-label="View mode"
          >
            <Button
              type="button"
              size="sm"
              variant={view === "list" ? "secondary" : "ghost"}
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
            >
              <List className="mr-1 h-4 w-4" />
              List
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "grid" ? "secondary" : "ghost"}
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
            >
              <Grid3X3 className="mr-1 h-4 w-4" />
              Grid
            </Button>
          </div>
        </div>
        {loading ? (
          <Card className="shadow-xs">
            <CardContent className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-md bg-surface-variant"
                />
              ))}
            </CardContent>
          </Card>
        ) : logs.length === 0 ? (
          <Card className="shadow-xs">
            <CardContent className="py-16 text-center text-sm text-text-tertiary">
              No audit entries match these filters.
            </CardContent>
          </Card>
        ) : view === "list" ? (
          <Card className="divide-y divide-border-subtle shadow-xs">
            {logs.map((entry) => (
              <ListEntry
                key={entry.id}
                entry={entry}
                expanded={expandedIds.has(entry.id)}
                onToggle={() => toggleEntry(entry.id)}
              />
            ))}
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {logs.map((entry) => (
              <GridEntry
                key={entry.id}
                entry={entry}
                expanded={expandedIds.has(entry.id)}
                onToggle={() => toggleEntry(entry.id)}
              />
            ))}
          </div>
        )}
        {!loading && totalPages > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-tertiary">
              Showing {visibleFrom}–{visibleTo} of {total.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: current.page! - 1,
                  }))
                }
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    page: current.page! + 1,
                  }))
                }
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
