import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { QuestionStatus, MediaType } from '../../../classes/enums';

export type FinalQuestionDocument = FinalQuestion & Document;

/**
 * final_questions â€” the distributed copy of an approved question into a
 * specific Indian state. Created when a Distributor assigns one or more
 * Indian states to an approved question. See final-question.entity.ts for
 * the canonical TypeORM counterpart (kept in sync for documentation purposes).
 *
 * Snapshot semantics
 * ------------------
 * Every final_question row carries a denormalized snapshot of the original
 * `Question` document (see the `userId / language / domains / ... / approvalReason`
 * block below). After distribution, the final_question row is self-contained:
 * readers do NOT need to $lookup the source question to see its full context
 * (text, media, language, asker's home state/district, etc.).
 *
 * Field-naming collisions between this collection and `questions`:
 *   - `referenceQuestionId` â†” `Question._id` (the FK back to the source)
 *   - `distributionState`   â†” `Question.state` (different semantics! `state`
 *     here is the *target* Indian state the question is being distributed to,
 *     while the embedded `state` below is the *asker's home* state.)
 *   - `createdAt` / `updatedAt` â†” Mongoose timestamps of the distribution
 *     (when the row was created/updated). The source question's
 *     `createdAt` / `updatedAt` are NOT preserved on this row.
 *
 * NOTE: `referenceQuestionId` and `distributorId` are persisted as Mongo
 * `ObjectId` (BSON type 0x07), NOT as plain strings. They reference
 * `questions._id` and `users._id` respectively, which are themselves
 * `ObjectId` in Mongo. This enables proper index usage, $lookup joins,
 * and avoids string<->ObjectId coercion bugs in aggregation pipelines.
 */
@Schema({ collection: 'final_questions', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class FinalQuestion {
  _id: Types.ObjectId;

  // â”€â”€ Reference back to the source question â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** FK -> questions._id (ObjectId). Reference to the source Question. */
  @Prop({ name: 'referenceQuestionId', type: Types.ObjectId, required: true, index: true, ref: 'Question' })
  referenceQuestionId: Types.ObjectId;

  // â”€â”€ Distribution-side fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Target Indian state this question is being distributed to (e.g. 'Punjab').
   * Null on the canonical reference doc (see isReference / parentReferenceId
   * below); one row per non-null distributionState plus the single reference
   * row whose distributionState is null. */
  @Prop({ name: 'distributionState', type: String, required: false, default: null, index: true })
  distributionState: string | null;

  /** FK -> users._id (ObjectId) of the distributor who performed the assignment. */
  @Prop({ name: 'distributorId', type: Types.ObjectId, required: true, index: true, ref: 'User' })
  distributorId: Types.ObjectId;

  /** Optional free-form note from the distributor (e.g. campaign, batch id). */
  @Prop({ name: 'notes', type: String, default: null })
  notes: string | null;

  /** Soft-toggle; allow re-enabling/removing without a hard delete. */
  @Prop({ name: 'isActive', type: Boolean, default: true, index: true })
  isActive: boolean;

  // Reference / parent-child structure
  // The first doc written for a given referenceQuestionId is the canonical
  // 'original question' document (isReference: true, distributionState: null).
  // Each state-specific distribution row is a child of that reference, with
  // parentReferenceId pointing at the reference doc's _id. One distribution
  // of N states produces N+1 docs: 1 reference + N state children.

  /** True for the canonical reference doc; false for state-specific children. */
  @Prop({ name: 'isReference', type: Boolean, default: false, index: true })
  isReference: boolean;

  /** FK -> final_questions._id of the reference doc; null on the reference doc itself. */
  @Prop({ name: 'parentReferenceId', type: Types.ObjectId, default: null, ref: 'FinalQuestion', index: true })
  parentReferenceId: Types.ObjectId | null;

  // â”€â”€ Snapshot of the source Question (denormalized copy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** FK -> users._id of the asker who originally submitted the source Question.
   * Persisted as a Mongo ObjectId (BSON 0x07), NOT a plain string, so the
   * field can be used directly in $lookup joins against the users collection
   * and benefits from proper index usage. Stored as null if the source
   * Question has no userId (e.g. legacy data). */
  @Prop({ name: 'userId', type: Types.ObjectId, ref: 'User', required: false, default: null, index: true })
  userId: Types.ObjectId | null;

  @Prop({ name: 'language', type: String, default: 'en' })
  language: string;

  @Prop({ name: 'domains', type: [String], default: [] })
  domains: string[];

  @Prop({ name: 'season', type: String, default: null })
  season: string | null;

  @Prop({ name: 'cropType', type: String, default: null })
  cropType: string | null;

  @Prop({ name: 'agroClimaticZone', type: String, default: null })
  agroClimaticZone: string | null;

  /** Asker's HOME state â€” distinct from `distributionState` above. */
  @Prop({ name: 'state', type: String, default: null })
  state: string | null;

  @Prop({ name: 'district', type: String, default: null })
  district: string | null;

  @Prop({ name: 'block', type: String, default: null })
  block: string | null;

  /** Snapshot of Question.questionText at distribution time (for display/search). */
  @Prop({ name: 'questionText', type: String, required: true })
  questionText: string;

  /** Vector embedding â€” copied from Question. May be large; see header note. */
  @Prop({ name: 'embedding', type: [Number], default: null })
  embedding: number[] | null;

  @Prop({ name: 'mediaType', type: String, enum: MediaType, default: MediaType.NONE })
  mediaType: MediaType;

  @Prop({ name: 'mediaUrls', type: [String], default: null })
  mediaUrls: string[] | null;

  @Prop({ name: 'deviceInfo', type: Object, default: null })
  deviceInfo: Record<string, unknown> | null;

  /** Source question's status at the time of distribution (typically APPROVED). */
  @Prop({ name: 'status', type: String, enum: QuestionStatus, default: null })
  status: QuestionStatus | null;

  @Prop({ name: 'duplicateFlag', type: Boolean, default: false })
  duplicateFlag: boolean;

  @Prop({ name: 'duplicateOfId', type: String, default: null })
  duplicateOfId: string | null;

  @Prop({ name: 'submittedAt', type: Date, default: null })
  submittedAt: Date | null;

  @Prop({ name: 'reviewedAt', type: Date, default: null })
  reviewedAt: Date | null;

  /** FK -> users._id of the curator/admin who reviewed the source Question.
   * Persisted as a Mongo ObjectId (BSON 0x07), NOT a plain string, for the
   * same reasons as userId above (proper $lookup joins + index usage). Null
   * if the source Question was never reviewed (e.g. still pending). */
  @Prop({ name: 'reviewerId', type: Types.ObjectId, ref: 'User', default: null, index: true })
  reviewerId: Types.ObjectId | null;

  @Prop({ name: 'rejectionReason', type: String, default: null })
  rejectionReason: string | null;

  @Prop({ name: 'heldReason', type: String, default: null })
  heldReason: string | null;

  @Prop({ name: 'approvalReason', type: String, default: null })
  approvalReason: string | null;

  // â”€â”€ Distribution timestamps (Mongoose-managed) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** When this final_question row was created (Mongoose timestamp). */
  @Prop({ name: 'createdAt' })
  createdAt: Date;

  /** When this final_question row was last updated (Mongoose timestamp). */
  @Prop({ name: 'updatedAt' })
  updatedAt: Date;
}
export const FinalQuestionSchema = SchemaFactory.createForClass(FinalQuestion);

// Enforce one row per (referenceQuestionId, distributionState) pair
FinalQuestionSchema.index({ referenceQuestionId: 1, distributionState: 1 }, { unique: true });

// Fast lookup of state docs that belong to a given reference doc.
FinalQuestionSchema.index({ parentReferenceId: 1 });

// Fast lookups by asker / reviewer FKs (used by moderation dashboards and
// per-user activity feeds that aggregate off final_questions snapshots).
FinalQuestionSchema.index({ userId: 1 });
FinalQuestionSchema.index({ reviewerId: 1 });
