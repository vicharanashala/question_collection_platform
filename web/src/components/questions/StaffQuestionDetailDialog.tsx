import { useState, type ElementType, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle,
  CloudRain,
  Copy,
  Film,
  Globe,
  MapPin,
  Mic,
  PauseCircle,
  Phone,
  Sprout,
  Wheat,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AudioPlayer } from "@/components/AudioPlayer";
import { StaffAnveshanAnswerSection } from "@/components/anveshan-answers/StaffAnveshanAnswerSection";
import { QuestionStatusBadge, isStatusHidden } from "@/components/questions/QuestionStatusBadge";
import { TranslatableText } from "@/components/TranslatableText";
import { TesterTag } from "@/components/TesterTag";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLocationPart } from "@/lib/questionExport";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { Question } from "@/types";

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|wav|flac|aiff)$/i;
// Signed storage URLs carry a query string, so only the path is matched.
const isAudioUrl = (url: string) => AUDIO_EXT.test(url.split("?")[0]);

interface StaffQuestionDetailDialogProps {
  question: Question;
  onClose: () => void;
}

// Read-only dialog showing a question, the Anveshan user's answer, and submitter and review details.
export function StaffQuestionDetailDialog({ question: q, onClose }: StaffQuestionDetailDialogProps) {
  const [lang, setLang] = useState("");

  const mediaUrls = q.mediaUrls ?? [];
  const imageUrls = mediaUrls.filter((url) => !isAudioUrl(url));
  const audioUrls = [...(q.audioUrls ?? []), ...mediaUrls.filter(isAudioUrl)];
  const showAnswer = !!q.isAnveshan || !!q.isAnswerSubmitted;
  const hasReviewNotes = !!(q.approvalReason || q.rejectionReason || q.heldReason);
  const submitterName = q.user?.name ?? q.userName ?? "Unknown user";
  const contact = q.user?.mobileNumber ?? q.userMobileNumber;
  const locationText = (["village", "block", "district", "state"] as const)
    .map((key) => getLocationPart(q, key))
    .filter(Boolean)
    .join(", ");

  // Copies the question id so staff can search for it elsewhere.
  const copyId = () => {
    navigator.clipboard
      .writeText(q.id)
      .then(() => toast.success("Question ID copied"))
      .catch(() => toast.error("Could not copy the ID"));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[90vw] xl:max-w-7xl">
        <DialogHeader className="shrink-0 space-y-0 border-b border-border-subtle bg-muted/30 px-4 py-4 pr-12 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <DialogTitle className="text-lg font-bold sm:text-xl">Question Details</DialogTitle>
            <QuestionStatusBadge question={q} />
            {q.isAnveshan && !isStatusHidden(q) && (
              <Badge className="bg-emerald-600 px-2 py-0.5 text-[11px] text-white sm:text-xs">
                <Sprout className="mr-1 h-3 w-3" aria-hidden="true" /> Anveshan
              </Badge>
            )}
            {q.user?.isTester && <TesterTag />}
            {q.duplicateFlag && (
              <Badge variant="destructive" className="px-2 py-0.5 text-[11px] sm:text-xs">
                <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" /> Duplicate
              </Badge>
            )}
            <button
              type="button"
              onClick={copyId}
              title="Copy question ID"
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              #{q.id.slice(-8)}
              <Copy className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
          <DialogDescription className="mt-1 text-xs">
            Submitted {formatDate(q.submittedAt)} by {submitterName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid flex-1 gap-5 overflow-y-auto px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main column */}
          <div className="min-w-0 space-y-5">
            <section className="rounded-xl border border-border-subtle border-l-4 border-l-primary bg-surface p-4 sm:p-5">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Question
              </h3>
              <div className="text-base leading-relaxed">
                <TranslatableText
                  text={q.questionText}
                  selectedLang={lang}
                  onLangChange={setLang}
                  sourceLanguage={q.language ?? "en"}
                  inline
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
                {(q.domains ?? []).map((domain) => (
                  <span
                    key={domain}
                    className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium capitalize text-primary"
                  >
                    {domain}
                  </span>
                ))}
                <Chip icon={Wheat} text={q.cropType} />
                <Chip icon={CloudRain} text={q.season} />
                <Chip icon={Globe} text={q.language?.toUpperCase()} />
              </div>
            </section>

            {showAnswer && <StaffAnveshanAnswerSection questionId={q.id} />}

            {hasReviewNotes && (
              <Panel title="Review Notes">
                <div className="space-y-2">
                  {q.rejectionReason && (
                    <ReviewNote tone="rejected" icon={XCircle} title="Rejection Reason" body={q.rejectionReason} />
                  )}
                  {q.approvalReason && (
                    <ReviewNote tone="approved" icon={CheckCircle} title="Approval Reason" body={q.approvalReason} />
                  )}
                  {q.heldReason && (
                    <ReviewNote tone="held" icon={PauseCircle} title="Hold Reason" body={q.heldReason} />
                  )}
                </div>
              </Panel>
            )}

            {imageUrls.length > 0 && (
              <Panel title={`Images (${imageUrls.length})`} icon={Film}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {imageUrls.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Question attachment ${i + 1}`}
                        className="h-32 w-full rounded-lg border object-cover transition-opacity hover:opacity-80"
                      />
                    </a>
                  ))}
                </div>
              </Panel>
            )}

            {audioUrls.length > 0 && (
              <Panel title="Audio Recordings" icon={Mic}>
                <div className="space-y-2">
                  {audioUrls.map((url) => (
                    <AudioPlayer key={url} src={url} className="w-full max-w-md" />
                  ))}
                </div>
              </Panel>
            )}
          </div>

          {/* Side column */}
          <aside className="space-y-5">
            <Panel title="Submitted By">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
                  aria-hidden="true"
                >
                  {getInitials(submitterName, contact ?? "")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{submitterName}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {q.isAnveshan ? "Anveshan User" : "Regular User"}
                    {q.user?.isTester && <TesterTag />}
                  </p>
                </div>
              </div>
              {contact && (
                <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <span className="font-mono">{contact}</span>
                </p>
              )}
            </Panel>

            <Panel title="Location" icon={MapPin}>
              {locationText ? (
                <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
                  <Field label="State" value={getLocationPart(q, "state")} />
                  <Field label="District" value={getLocationPart(q, "district")} />
                  <Field label="Block" value={getLocationPart(q, "block")} />
                  <Field label="Village" value={getLocationPart(q, "village")} />
                  {q.isAnveshan &&
                    q.submissionLocation?.latitude != null &&
                    q.submissionLocation?.longitude != null && (
                      <Field
                        label="Coordinates"
                        wide
                        value={`${q.submissionLocation.latitude.toFixed(5)}, ${q.submissionLocation.longitude.toFixed(5)}`}
                      />
                    )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">No location recorded.</p>
              )}
            </Panel>

            <Panel title="Timeline">
              <ol className="space-y-3 border-l border-border-subtle pl-4">
                <TimelineItem label="Submitted" date={formatDate(q.submittedAt)} />
                {q.reviewedAt && (
                  <TimelineItem
                    label="Reviewed"
                    date={formatDate(q.reviewedAt)}
                    note={q.reviewedByName ? `by ${q.reviewedByName}` : undefined}
                  />
                )}
              </ol>
            </Panel>

            <Panel title="Question ID">
              <p className="break-all font-mono text-[11px] text-muted-foreground">{q.id}</p>
            </Panel>
          </aside>
        </div>

        <DialogFooter className="shrink-0 border-t border-border-subtle px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon?: ElementType; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

// Compact pill for one fact about the question. Empty values are skipped.
function Chip({ icon: Icon, text }: { icon: ElementType; text?: string | null }) {
  if (!text) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
      <Icon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
      {text}
    </span>
  );
}

// Label above value, skipped when the value is empty.
function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

function TimelineItem({ label, date, note }: { label: string; date: string | null; note?: string }) {
  return (
    <li className="relative">
      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">
        {date}
        {note ? ` ${note}` : ""}
      </p>
    </li>
  );
}

const NOTE_TONES = {
  approved: "border-success/30 bg-success/5 text-success",
  rejected: "border-destructive/30 bg-destructive/5 text-destructive",
  held: "border-warning/30 bg-warning/5 text-warning",
};

function ReviewNote({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: keyof typeof NOTE_TONES;
  icon: ElementType;
  title: string;
  body: string;
}) {
  return (
    <div className={cn("rounded-lg border p-3", NOTE_TONES[tone])}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{body}</p>
    </div>
  );
}
