import { useState, type ElementType, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  CloudRain,
  Film,
  Globe,
  Hash,
  Info,
  MapPin,
  Mic,
  PauseCircle,
  Phone,
  Sprout,
  User,
  Wheat,
  XCircle,
} from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { StaffAnveshanAnswerSection } from "@/components/anveshan-answers/StaffAnveshanAnswerSection";
import { QuestionStatusBadge } from "@/components/questions/QuestionStatusBadge";
import { TranslatableText } from "@/components/TranslatableText";
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
import { cn, formatDate } from "@/lib/utils";
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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92dvh] w-[95vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 space-y-2 border-b border-border-subtle px-4 py-4 pr-12 sm:px-6">
          <DialogTitle className="text-base font-bold sm:text-lg">Question Details</DialogTitle>
          <DialogDescription className="sr-only">Full information for the selected question.</DialogDescription>
          <div className="flex flex-wrap items-center gap-2">
            <QuestionStatusBadge question={q} />
            {q.isAnveshan && (
              <Badge className="bg-emerald-600 px-2 py-0.5 text-[11px] text-white sm:text-xs">
                <Sprout className="mr-1 h-3 w-3" aria-hidden="true" /> Anveshan User
              </Badge>
            )}
            {q.duplicateFlag && (
              <Badge variant="destructive" className="px-2 py-0.5 text-[11px] sm:text-xs">
                <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" /> Duplicate
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">Submitted {formatDate(q.submittedAt)}</span>
          </div>
        </DialogHeader>

        <div className="grid flex-1 gap-4 overflow-y-auto px-4 py-4 sm:px-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Section title="Question">
              <TranslatableText
                text={q.questionText}
                selectedLang={lang}
                onLangChange={setLang}
                sourceLanguage={q.language ?? "en"}
                inline
              />
            </Section>

            {showAnswer && <StaffAnveshanAnswerSection questionId={q.id} />}

            {hasReviewNotes && (
              <Section title="Review Notes">
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
              </Section>
            )}

            {imageUrls.length > 0 && (
              <Section title={`Images (${imageUrls.length})`} icon={Film}>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {imageUrls.map((url, i) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Question attachment ${i + 1}`}
                        className="h-28 w-full rounded-md border object-cover transition-opacity hover:opacity-80"
                      />
                    </a>
                  ))}
                </div>
              </Section>
            )}

            {audioUrls.length > 0 && (
              <Section title="Audio Recordings" icon={Mic}>
                <div className="space-y-2">
                  {audioUrls.map((url) => (
                    <AudioPlayer key={url} src={url} className="w-full max-w-sm" />
                  ))}
                </div>
              </Section>
            )}
          </div>

          <aside className="space-y-4">
            <Section title="Details">
              <dl className="space-y-3">
                <DetailRow icon={Hash} label="Question ID" value={<span className="break-all font-mono text-xs">{q.id}</span>} />
                <DetailRow icon={Info} label="Category" value={(q.domains ?? []).join(", ")} />
                <DetailRow icon={Wheat} label="Crop" value={q.cropType} />
                <DetailRow icon={CloudRain} label="Season" value={q.season} />
                <DetailRow icon={Globe} label="Language" value={q.language?.toUpperCase()} />
              </dl>
            </Section>

            <Section title="Location">
              <dl className="space-y-3">
                <DetailRow icon={MapPin} label="State" value={getLocationPart(q, "state")} />
                <DetailRow icon={MapPin} label="District" value={getLocationPart(q, "district")} />
                <DetailRow icon={MapPin} label="Block" value={getLocationPart(q, "block")} />
                <DetailRow icon={MapPin} label="Village" value={getLocationPart(q, "village")} />
                {q.isAnveshan &&
                  q.submissionLocation?.latitude != null &&
                  q.submissionLocation?.longitude != null && (
                    <DetailRow
                      icon={MapPin}
                      label="Coordinates"
                      value={`${q.submissionLocation.latitude.toFixed(5)}, ${q.submissionLocation.longitude.toFixed(5)}`}
                    />
                  )}
              </dl>
            </Section>

            <Section title="Submission">
              <dl className="space-y-3">
                <DetailRow icon={User} label="Submitted By" value={q.user?.name ?? q.userName} />
                <DetailRow icon={Phone} label="Contact" value={q.user?.mobileNumber ?? q.userMobileNumber} />
                <DetailRow icon={Clock} label="Submitted" value={formatDate(q.submittedAt)} />
                <DetailRow icon={Clock} label="Reviewed" value={formatDate(q.reviewedAt)} />
                <DetailRow icon={User} label="Reviewed By" value={q.reviewedByName} />
              </dl>
            </Section>
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

function Section({ title, icon: Icon, children }: { title: string; icon?: ElementType; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border-subtle bg-surface p-3 sm:p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

// Label above value so long values wrap cleanly in the narrow side column. Empty values are skipped.
function DetailRow({ icon: Icon, label, value }: { icon: ElementType; label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd className="break-words text-sm font-medium text-foreground">{value}</dd>
      </div>
    </div>
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
