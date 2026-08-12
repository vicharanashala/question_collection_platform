import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
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
@Entity('final_questions')
@Index('idx_final_questions_reference_distribution', ['referenceQuestionId', 'distributionState'], { unique: true })
@Index('idx_final_questions_distribution_state', ['distributionState'])
@Index('idx_final_questions_distributor', ['distributorId'])
@Index('idx_final_questions_parent_reference', ['parentReferenceId'])
@Index('idx_final_questions_user', ['userId'])
@Index('idx_final_questions_reviewer', ['reviewerId'])
@Index('idx_final_questions_created_at', ['createdAt'])
export class FinalQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Reference back to the source question ─────────────────────────────────

  /** FK -> questions._id. Stored as Mongo ObjectId (see schema). */
  @Column({ name: 'reference_question_id', type: 'uuid' })
  referenceQuestionId: string;

  // ── Distribution-side fields ──────────────────────────────────────────────

  /** Indian state this question is being distributed to (e.g. 'Punjab').
   * Null on the canonical reference doc (see isReference / parentReferenceId
   * below); one row per non-null distributionState, plus the single reference
   * row whose distributionState is null. */
  @Column({ name: 'distribution_state', type: 'varchar', length: 100, nullable: true })
  distributionState: string | null;

  /** FK -> users._id (the distributor who performed the assignment). Stored as Mongo ObjectId (see schema). */
  @Column({ name: 'distributor_id', type: 'uuid' })
  distributorId: string;

  /** Optional free-form note from the distributor (e.g. campaign, batch id). */
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  /** Soft-toggle; allow re-enabling/removing without a hard delete. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // ── Reference / parent-child structure ────────────────────────────────────
  // For each (referenceQuestionId) one canonical "original question" doc
  // exists (isReference: true, distributionState: null). Each state-specific
  // row is a child of that reference, with parentReferenceId pointing at it.
  // One distribution of N states produces N+1 docs: 1 reference + N children.

  /** True for the canonical reference doc; false for state-specific children. */
  @Column({ name: 'is_reference', type: 'boolean', default: false })
  isReference: boolean;

  /** FK -> final_questions._id of the reference doc; null on the reference doc itself. */
  @Column({ name: 'parent_reference_id', type: 'uuid', nullable: true })
  parentReferenceId: string | null;

  // ── Snapshot of the source Question (denormalized copy) ───────────────────

  /** Question.userId — FK -> users._id of the asker. Stored as a Mongo
   * `ObjectId` (BSON 0x07) in the database; the `uuid` column type here
   * represents the 24-char hex `ObjectId` representation (see header note).
   * Null if the source Question had no `userId` (legacy data). */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'language', type: 'varchar', length: 50, nullable: true, default: 'en' })
  language: string;

  @Column({ name: 'domains', type: 'text', array: true, nullable: true, default: '{}' })
  domains: string[];

  @Column({ name: 'season', type: 'varchar', length: 50, nullable: true })
  season: string | null;

  @Column({ name: 'crop_type', type: 'varchar', length: 255, nullable: true })
  cropType: string | null;

  @Column({ name: 'agro_climatic_zone', type: 'varchar', length: 255, nullable: true })
  agroClimaticZone: string | null;

  /** Asker's HOME state — distinct from `distributionState` above. */
  @Column({ name: 'state', type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ name: 'district', type: 'varchar', length: 100, nullable: true })
  district: string | null;

  @Column({ name: 'block', type: 'varchar', length: 100, nullable: true })
  block: string | null;

  /** Snapshot of Question.questionText at distribution time. */
  @Column({ name: 'question_text', type: 'text' })
  questionText: string;

  /** Vector embedding — copied from Question. See schema docstring. */
  @Column({ name: 'embedding', type: 'float8', array: true, nullable: true })
  embedding: number[] | null;

  @Column({ name: 'media_type', type: 'varchar', length: 10, nullable: true })
  mediaType: MediaType | null;

  @Column({ name: 'media_urls', type: 'jsonb', nullable: true })
  mediaUrls: string[] | null;

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo: Record<string, unknown> | null;

  /** Source question's status at the time of distribution. */
  @Column({ name: 'status', type: 'varchar', length: 20, nullable: true })
  status: QuestionStatus | null;

  @Column({ name: 'duplicate_flag', type: 'boolean', nullable: true, default: false })
  duplicateFlag: boolean;

  @Column({ name: 'duplicate_of_id', type: 'uuid', nullable: true })
  duplicateOfId: string | null;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  /** Question.reviewerId — FK -> users._id of the curator/admin who reviewed
   * the source Question. Stored as a Mongo `ObjectId` (BSON 0x07); the
   * `uuid` column type here represents the 24-char hex `ObjectId`
   * representation (see header note). Null if the source Question was never
   * reviewed. */
  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId: string | null;

  @Column({ name: 'rejection_reason', type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'held_reason', type: 'varchar', length: 500, nullable: true })
  heldReason: string | null;

  @Column({ name: 'approval_reason', type: 'varchar', length: 500, nullable: true })
  approvalReason: string | null;

  // ── Distribution timestamps (Mongoose-managed) ────────────────────────────

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}