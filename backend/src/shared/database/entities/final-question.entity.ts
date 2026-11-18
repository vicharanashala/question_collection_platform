import { QuestionStatus, MediaType } from '../../classes/enums';

/**
 * final_questions — the distributed copy of an approved question into a
 * specific Indian state. Created when a Distributor assigns one or more
 * Indian states to an approved question.
 *
 * Each (referenceQuestionId, distributionState) pair produces exactly one row,
 * so a single question can be distributed to many states while remaining a
 * single source of truth.
 *
 * Snapshot semantics
 * ------------------
 * Every final_question row carries a denormalized snapshot of the original
 * `Question` document so that, after distribution, the row is self-contained
 * (no $lookup needed to display context like language, asker's home state,
 * media URLs, etc.). See `final-question.schema.ts` for the full docstring
 * and field-naming notes; this entity is the TypeORM mirror kept in sync.
 *
 * NOTE: This TypeORM entity is a documentation-only mirror of the canonical
 * Mongo schema (`final-question.schema.ts`). The project uses MongoDB as its
 * only DB driver (see `db.module.ts`). The `uuid` column types below reflect
 * the 24-char hex `ObjectId` representation in Mongo — i.e. values are
 * written and read as `Types.ObjectId` (BSON 0x07), not plain strings.
 */
export interface FinalQuestion {
  id: string;

  // ── Reference back to the source question ─────────────────────────────────

  /** FK -> questions._id. Stored as Mongo ObjectId (see schema). */
  referenceQuestionId: string;

  // ── Distribution-side fields ──────────────────────────────────────────────

  /** Indian state this question is being distributed to (e.g. 'Punjab').
   * Null on the canonical reference doc (see isReference / parentReferenceId
   * below); one row per non-null distributionState, plus the single reference
   * row whose distributionState is null. */
  distributionState: string | null;

  /** FK -> users._id (the distributor who performed the assignment). Stored as Mongo ObjectId (see schema). */
  distributorId: string;

  /** Optional free-form note from the distributor (e.g. campaign, batch id). */
  notes: string | null;

  /** Soft-toggle; allow re-enabling/removing without a hard delete. */
  isActive: boolean;

  // ── Reference / parent-child structure ────────────────────────────────────
  // For each (referenceQuestionId) one canonical "original question" doc
  // exists (isReference: true, distributionState: null). Each state-specific
  // row is a child of that reference, with parentReferenceId pointing at it.
  // One distribution of N states produces N+1 docs: 1 reference + N children.

  /** True for the canonical reference doc; false for state-specific children. */
  isReference: boolean;

  /** FK -> final_questions._id of the reference doc; null on the reference doc itself. */
  parentReferenceId: string | null;

  // ── Snapshot of the source Question (denormalized copy) ───────────────────

  /** Question.userId — FK -> users._id of the asker. Stored as a Mongo
   * `ObjectId` (BSON 0x07) in the database; the `uuid` column type here
   * represents the 24-char hex `ObjectId` representation (see header note).
   * Null if the source Question had no `userId` (legacy data). */
  userId: string | null;

  language: string;

  domains: string[];

  season: string | null;

  cropType: string | null;

  agroClimaticZone: string | null;

  /** Asker's HOME state — distinct from `distributionState` above. */
  state: string | null;

  district: string | null;

  block: string | null;

  /** Snapshot of Question.questionText at distribution time. */
  questionText: string;

  /** Vector embedding — copied from Question. See schema docstring. */
  embedding: number[] | null;

  mediaType: MediaType | null;

  mediaUrls: string[] | null;

  audioUrls: string[] | null;

  deviceInfo: Record<string, unknown> | null;

  /** Source question's status at the time of distribution. */
  status: QuestionStatus | null;

  duplicateFlag: boolean;

  duplicateOfId: string | null;

  submittedAt: Date | null;

  reviewedAt: Date | null;

  /** Question.reviewerId — FK -> users._id of the curator/admin who reviewed
   * the source Question. Stored as a Mongo `ObjectId` (BSON 0x07); the
   * `uuid` column type here represents the 24-char hex `ObjectId`
   * representation (see header note). Null if the source Question was never
   * reviewed. */
  reviewerId: string | null;

  rejectionReason: string | null;

  heldReason: string | null;

  approvalReason: string | null;

  // ── Distribution timestamps (Mongoose-managed) ────────────────────────────

  createdAt: Date;

  updatedAt: Date;
}