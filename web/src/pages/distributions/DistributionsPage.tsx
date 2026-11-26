import { useState } from "react";
import { DistributionsList } from "./DistributionsList";
import { ApprovedQueue } from "./ApprovedQueue";
import { Send, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isDistributor } from "@/lib/roles";
import { useTranslation } from "react-i18next";
import { ExportMenu } from "@/components/ExportMenu";
import { ExportColumn, exportDateTime } from "@/lib/exportData";
import { FinalQuestion } from "@/types";
import { distributor } from "@/api/client";
import { TesterFilterValue } from "@/components/TesterFilter";

/**
 * Distributor landing page.
 * Tabs:
 *   - Distributions : browse & manage final_questions rows
 *   - Approved Queue (distributor-only) : review approved questions and assign states
 *
 * The "Approved Queue" tab/flow is restricted to the `distributor` role.
 * Curators / admins / super_admins can still browse the read-only
 * Distributions tab for monitoring, but cannot perform the
 * promote-to-final action.
 */

const DISTRIBUTOR_EXPORT_COLUMN: ExportColumn<FinalQuestion>[] = [
  { header: "Id", value: (final) => final.id },
  { header: "Question", value: (final) => final.questionText },
  { header: "Note", value: (final) => final.notes ?? "No note found!!" },
  { header: "State", value: (final) => final.state },
  {
    header: "Distributor",
    value: (final) =>
      final.distributor?.name ||
      final.distributor?.username ||
      "Distributor not avialable",
  },
  { header: "Time Added", value: (final) => exportDateTime(final.createdAt) },
];
export function DistributionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canAssign = isDistributor(user);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [distributionState, setDistributionState] = useState<string>("");
  const [questionType, setQuestionType] = useState<
    "" | "original" | "distributed"
  >("");
  const [search, setSearch] = useState("");
  const [testerFilter, setTesterFilter] = useState<TesterFilterValue>("");
  // Distributors default to the queue; non-distributors land on the list
  // since they cannot perform the assign action.
  const [tab, setTab] = useState<"queue" | "distributions">(() =>
    canAssign ? "queue" : "distributions",
  );
  // Non-distributors are always forced onto the read-only Distributions view,
  // regardless of any stale `tab` value.
  const effectiveTab: "queue" | "distributions" = canAssign
    ? tab
    : "distributions";

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-lg sm:text-lg sm:text-xl font-semibold">
            {t("nav.distributions")}
          </h1>
          <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground">
            {t("distributorDashboardPage.distributeApprovedQuestionsTo")}
          </p>
        </div>
        <ExportMenu
          name="distributor"
          columns={DISTRIBUTOR_EXPORT_COLUMN}
          disabled={total === 0}
          fetchPage={(page, limit) =>
            distributor.listDistributions({
              page,
              limit,
              ...(distributionState ? { distributionState } : {}),
              ...(questionType ? { questionType } : {}),
              ...(search ? { search } : {}),
              ...(testerFilter ? { tester: testerFilter } : {}),
            })
          }
        />
      </header>

      <div className="border-b border-border px-6 flex gap-1">
        <button
          onClick={() => setTab("distributions")}
          className={`px-4 py-2 text-xs sm:text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            effectiveTab === "distributions"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Send className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          {t("nav.distributions")}
        </button>
        {canAssign && (
          <button
            onClick={() => setTab("queue")}
            className={`px-4 py-2 text-xs sm:text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              effectiveTab === "queue"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CheckCircle2 className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            {t("distributionsPage.approvedQueue")}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {effectiveTab === "distributions" ? (
          <DistributionsList
            page={page}
            setPage={setPage}
            limit={limit}
            setLimit={setLimit}
            total={total}
            setTotal={setTotal}
            distributionState={distributionState}
            setDistributionState={setDistributionState}
            questionType={questionType}
            setQuestionType={setQuestionType}
            search={search}
            setSearch={setSearch}
            testerFilter={testerFilter}
            setTesterFilter={setTesterFilter}
          />
        ) : (
          <ApprovedQueue />
        )}
      </div>
    </div>
  );
}

export default DistributionsPage;
