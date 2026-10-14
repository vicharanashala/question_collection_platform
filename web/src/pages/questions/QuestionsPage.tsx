import { useState, useEffect, useMemo } from "react";
import { questionApi, getErrorMessage } from "@/api/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TesterTag } from "@/components/TesterTag";
import { ExportMenu } from "@/components/ExportMenu";
import { QuestionStatusBadge } from "@/components/questions/QuestionStatusBadge";
import { StaffQuestionDetailDialog } from "@/components/questions/StaffQuestionDetailDialog";
import { TesterFilter, type TesterFilterValue } from "@/components/TesterFilter";
import { UserTypeFilter, type UserTypeFilterValue } from "@/components/questions/UserTypeFilter";
import { QUESTION_EXPORT_COLUMNS } from "@/lib/questionExport";
import { cn, formatDate, formatTime } from "@/lib/utils";
import { ListFilter, Search, MessageSquareReply } from "lucide-react";
import { toast } from "sonner";
import type { Question } from "@/types";
import {
  DataTable,
  CardView,
  ViewToggle,
  DualView,
  type ColumnDef,
} from "@/components/DataTable";

const SEASON_LABEL: Record<string, string> = {
  Kharif: "Kharif",
  Rabi: "Rabi",
  Zaid: "Zaid",
  "Pre-Kharif": "Pre-Kharif",
  "Post-Kharif": "Post-Kharif",
  "Pre-Rabi": "Pre-Rabi",
  "Zaid Rabi": "Zaid Rabi",
  Spring: "Spring",
  Summer: "Summer",
  Autumn: "Autumn",
  Winter: "Winter",
  Monsoon: "Monsoon",
  "Dry Season": "Dry Season",
  "Wet Season": "Wet Season",
};

// ─── Anveshan answer filter ───────────────────────────────────────────────────

type AnswerFilter = "" | "answered" | "unanswered";

const ANSWER_FILTER_OPTIONS: { value: AnswerFilter; label: string }[] = [
  { value: "", label: "All answers" },
  { value: "answered", label: "Answered (Anveshan)" },
  { value: "unanswered", label: "Awaiting answer (Anveshan)" },
];

// ─── Questions page ───────────────────────────────────────────────────────────

export function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "held" | "approved" | "rejected" | "pending" | ""
  >("");
  const [answerFilter, setAnswerFilter] = useState<AnswerFilter>("");
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilterValue>("");
  const [testerFilter, setTesterFilter] = useState<TesterFilterValue>("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"table" | "card">("table");
  const limit = 10;
  const cardLimit = 9;
  const debouncedSearch = useDebouncedValue(search, 400);

  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null);
  const [apiTotal, setApiTotal] = useState(0);

  // Client-side sort — newest first
  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) =>
      a.submittedAt < b.submittedAt ? 1 : -1,
    ).map((question, index) => ({
      ...question,
      _slno: (page - 1) * limit + index + 1,
    }));
  }, [questions, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, answerFilter, userTypeFilter, testerFilter]);

  useEffect(() => {
    setLoading(true);
    const activeLimit = view === "card" ? cardLimit : limit;
    questionApi
      .getQuestions({
        page,
        limit: activeLimit,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        answerStatus: answerFilter || undefined,
        userType: userTypeFilter || undefined,
        tester: testerFilter || undefined,
      })
      .then((res) => {
        setQuestions(res.items as Question[]);
        setApiTotal(res.total);
      })
      .catch((e) => toast.error(getErrorMessage(e, "Failed to load questions")))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter, answerFilter, userTypeFilter, testerFilter, view]);

  const totalPages = Math.max(
    1,
    Math.ceil(apiTotal / (view === "card" ? cardLimit : limit)),
  );

  // ─── Table columns ─────────────────────────────────────────────────────────
  const columns: ColumnDef<Question>[] = [
    {
      key: "status",
      header: "Status",
      width: "110px",
      sortable: true,
      render: (q) => <QuestionStatusBadge question={q} />,
    },
    {
      key: "isAnswerSubmitted",
      header: "Answer",
      width: "110px",
      sortable: false,
      render: (q) =>
        q.isAnswerSubmitted ? (
          <Badge className="whitespace-nowrap bg-emerald-600 px-2 py-0.5 text-[11px] text-white sm:text-xs">
            <MessageSquareReply className="mr-1 h-3 w-3" aria-hidden="true" /> Answered
          </Badge>
        ) : q.isAnveshan ? (
          <Badge
            variant="outline"
            className="whitespace-nowrap border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 sm:text-xs dark:text-amber-400"
          >
            Awaiting
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground" aria-label="Not applicable">—</span>
        ),
    },
    {
      key: "questionText",
      header: "Question",
      width: "280px",
      sortable: false,
      render: (q) => (
        <span className="line-clamp-2 text-[11px] sm:text-xs">
          {q.questionText}
        </span>
      ),
    },
    {
      key: "submittedBy",
      header: "Submitted By",
      width: "130px",
      sortable: true,
      render: (q) => (
        <div className="min-w-0">
          <span
            className="text-[11px] sm:text-[11px] sm:text-xs truncate block"
            title={q.user?.name ?? q.userName ?? q.userMobileNumber ?? ""}
          >
            {q.user?.name ?? q.userName ?? q.userMobileNumber ?? "—"}
          </span>
          {q.user?.isTester && <TesterTag />}
        </div>
      ),
    },
    {
      key: "domains",
      header: "Category",
      width: "180px",
      sortable: true,
      render: (q) => (
        <span className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded capitalize">
          {(q.domains ?? []).join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "cropType",
      header: "Crop",
      width: "100px",
      sortable: true,
      render: (q) => (
        <span className="text-[11px] sm:text-[11px] sm:text-xs capitalize">
          {q.cropType ?? "—"}
        </span>
      ),
    },
    {
      key: "season",
      header: "Season",
      width: "90px",
      sortable: true,
      render: (q) => (
        <span className="text-[11px] sm:text-[11px] sm:text-xs capitalize">
          {SEASON_LABEL[q.season] ?? q.season ?? "—"}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      width: "140px",
      sortable: true,
      render: (q) => (
        <span
          className="text-[11px] sm:text-[11px] sm:text-xs truncate block"
          title={[q.district, q.state].filter(Boolean).join(", ")}
        >
          {[q.district, q.state].filter(Boolean).join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "submittedAt",
      header: "Submitted",
      width: "120px",
      sortable: true,
      render: (q) => (
        <div className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
          <div>{formatDate(q.submittedAt)}</div>
          <div>{formatTime(q.submittedAt)}</div>
        </div>
      ),
    },
    {
      key: "reviewedByName",
      header: "Reviewed By",
      width: "120px",
      sortable: true,
      render: (q) => (
        q.reviewedByName ? (
          <span className="text-[11px] sm:text-xs truncate block" title={q.reviewedByName}>
            {q.reviewedByName}
          </span>
        ) : (
          <Badge
            variant="outline"
            className="whitespace-nowrap px-2 py-0.5 text-[11px] text-muted-foreground sm:text-xs"
          >
            Not reviewed
          </Badge>
        )
      ),
    },
  ];

  // Serial number column is only shown in the table view.
  const tableColumns: ColumnDef<Question>[] = [
    {
      key: "_slno",
      header: "#",
      width: "50px",
      textAlign: "center",
      render: (q) => (
        <span className="text-[11px] text-muted-foreground sm:text-xs">
          {(q as Question & { _slno: number })._slno}
        </span>
      ),
    },
    ...columns,
  ];

  const emptyMessage =
    search || statusFilter || answerFilter || userTypeFilter || testerFilter
      ? "No questions match your filters"
      : "No questions yet";

  // ─── Card view ─────────────────────────────────────────────────────────────
  const tableComponent = (
    <DataTable
      data={sortedQuestions}
      columns={tableColumns}
      loading={loading}
      page={page}
      totalPages={totalPages}
      totalCount={apiTotal}
      hideSearch
      onPageChange={setPage}
      SkeletonRows={5}
      emptyMessage={emptyMessage}
      onRowClick={(row) => {
        setDetailQuestion(row as Question);
      }}
    />
  );

  const cardComponent = (
    <CardView
      data={sortedQuestions}
      columns={columns}
      loading={loading}
      page={page}
      totalPages={totalPages}
      totalCount={apiTotal}
      onPageChange={setPage}
      SkeletonRows={6}
      emptyMessage={emptyMessage}
      onRowClick={(row) => {
        setDetailQuestion(row as Question);
      }}
    />
  );

  const hasActiveFilters = !!(search || statusFilter || answerFilter || userTypeFilter || testerFilter);

  // Resets every filter and the search box.
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setAnswerFilter("");
    setUserTypeFilter("");
    setTesterFilter("");
    setPage(1);
  };

  // ─── Status filter chips ───────────────────────────────────────────────────
  const statusOptions: {
    value: "held" | "approved" | "rejected" | "pending" | "";
    label: string;
  }[] = [
    { value: "", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "held", label: "On Hold" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className="space-y-5">
      {/* ─── Page header ─── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            Questions
          </h2>
          <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground mt-0.5">
            All submitted questions
          </p>
        </div>
        <div className="flex items-center gap-3">
          {apiTotal > 0 && (
            <span className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground hidden sm:block">
              {apiTotal.toLocaleString()} total
            </span>
          )}
          <ExportMenu
            name="questions"
            columns={QUESTION_EXPORT_COLUMNS}
            disabled={apiTotal === 0}
            fetchPage={(exportPage, exportLimit) =>
              questionApi.getQuestions({
                page: exportPage,
                limit: exportLimit,
                search: debouncedSearch || undefined,
                status: statusFilter || undefined,
                answerStatus: answerFilter || undefined,
                userType: userTypeFilter || undefined,
                tester: testerFilter || undefined,
              })
            }
          />
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* ─── Filter bar ─── */}
      <Card>
        <div className="space-y-4 p-4">
          {/* Search and dropdown filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_200px]">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search questions"
                placeholder="Search crop, keyword, location..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <UserTypeFilter value={userTypeFilter} onChange={setUserTypeFilter} />
            <TesterFilter value={testerFilter} onChange={setTesterFilter} />
            <Select
              value={answerFilter || "all"}
              onValueChange={(v) => setAnswerFilter(v === "all" ? "" : (v as AnswerFilter))}
            >
              <SelectTrigger className="w-full" aria-label="Filter by answer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANSWER_FILTER_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value || "all"} value={value || "all"}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter — chips on desktop, dropdown on mobile */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ListFilter className="h-4 w-4 shrink-0" aria-hidden="true" />
              Status
            </span>
            <div className="hidden flex-wrap items-center gap-1.5 sm:flex">
              {statusOptions.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150",
                    statusFilter === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-subtle bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-w-0 flex-1 sm:hidden">
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as typeof statusFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full" aria-label="Filter by status">
                  <SelectValue>
                    {statusOptions.find((o) => o.value === statusFilter)?.label ?? "All"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto text-xs font-medium text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* ─── Dual view ─── */}
      <DualView
        view={view}
        tableComponent={tableComponent}
        cardComponent={cardComponent}
      />

      {/* ─── Question detail dialog ─── */}
      {detailQuestion && (
        <StaffQuestionDetailDialog
          key={detailQuestion.id}
          question={detailQuestion}
          onClose={() => setDetailQuestion(null)}
        />
      )}
    </div>
  );
}
