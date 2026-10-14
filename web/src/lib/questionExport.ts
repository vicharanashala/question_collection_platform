import { getStatusLabel } from "@/components/questions/QuestionStatusBadge";
import { exportIsoDate, type ExportColumn } from "@/lib/exportData";
import type { Question } from "@/types";

const MEDIA_TYPE_LABELS: Record<string, string> = {
  none: "Text",
  image: "Image",
  video: "Video",
  audio: "Voice",
};

// Anveshan questions record the capture location separately from the profile location.
export function getLocationPart(q: Question, key: "state" | "district" | "block" | "village"): string {
  const captured = q.isAnveshan ? q.submissionLocation?.[key] : null;
  return captured || q[key] || "";
}

/** Export columns shared by the Questions and Review Queue pages. Raw ids and answers are left out. */
export const QUESTION_EXPORT_COLUMNS: ExportColumn<Question>[] = [
  { header: "Question ID", value: (q) => q.id },
  { header: "Question", value: (q) => q.questionText },
  { header: "Status", value: (q) => getStatusLabel(q) },
  { header: "Category", value: (q) => (q.domains ?? []).join(", ") },
  { header: "Crop", value: (q) => q.cropType },
  { header: "Season", value: (q) => q.season },
  { header: "Language", value: (q) => q.language?.toUpperCase() },
  { header: "Question Source", value: (q) => MEDIA_TYPE_LABELS[q.mediaType] ?? q.mediaType },
  { header: "User Name", value: (q) => q.user?.name ?? q.userName },
  { header: "User Type", value: (q) => (q.isAnveshan ? "Anveshan" : "Regular User") },
  { header: "User Contact", value: (q) => q.user?.mobileNumber ?? q.userMobileNumber },
  { header: "State", value: (q) => getLocationPart(q, "state") },
  { header: "District", value: (q) => getLocationPart(q, "district") },
  { header: "Block", value: (q) => getLocationPart(q, "block") },
  { header: "Village", value: (q) => getLocationPart(q, "village") },
  { header: "Reviewed By", value: (q) => q.reviewedByName },
  { header: "Submitted At", value: (q) => exportIsoDate(q.submittedAt) },
  { header: "Reviewed At", value: (q) => exportIsoDate(q.reviewedAt) },
  { header: "Created At", value: (q) => exportIsoDate(q.createdAt) },
  { header: "Updated At", value: (q) => exportIsoDate(q.updatedAt) },
];
