import { BaseRepository } from '../abstractions/base.repository';
import { FinalQuestion } from '../entities';

/**
 * Filter shape for `findAndCount` queries against `final_questions`.
 * Field names mirror the canonical Mongo schema (camelCase).
 */
export interface FinalQuestionFilter {
  /** Filter by FK to source Question (renamed from `questionId`). */
  referenceQuestionId?: string;
  /** Filter by target Indian state (renamed from `state`). */
  distributionState?: string;
  distributorId?: string;
  isActive?: boolean;
  createdAt?: Date;
}

export interface IFinalQuestionRepository extends BaseRepository<FinalQuestion> {
  /** All distribution rows for a given source question (one per assigned state). */
  findByReferenceQuestionId(referenceQuestionId: string): Promise<FinalQuestion[]>;

  /** All distribution rows targeting a given Indian state. */
  findByDistributionState(distributionState: string): Promise<FinalQuestion[]>;

  /** All distribution rows created by a particular distributor. */
  findByDistributorId(distributorId: string): Promise<FinalQuestion[]>;

  /** Look up a single (referenceQuestionId, distributionState) pair. Returns null if not assigned. */
  findByReferenceQuestionAndDistributionState(
    referenceQuestionId: string,
    distributionState: string,
  ): Promise<FinalQuestion | null>;

  /**
   * Find the canonical reference doc for a given source question. The
   * reference doc is the "original question" written to final_questions on
   * the very first distribution of that question (isReference: true,
   * distributionState: null, parentReferenceId: null). Returns null if no
   * distribution has been performed yet for this question.
   */
  findReferenceByQuestionId(referenceQuestionId: string): Promise<FinalQuestion | null>;

  /**
   * Find all state-specific child docs whose `parentReferenceId` equals the
   * given reference doc id. Excludes the reference doc itself (it has
   * parentReferenceId: null). Returns [] when the reference has no children.
   */
  findStateDocsByParentId(parentReferenceId: string): Promise<FinalQuestion[]>;

  /**
   * Count distribution rows per TARGET Indian state for the dashboard
   * "States covered" widget. Groups by `distributionState` (the state the
   * question was distributed TO) — NOT by the source `state` field, which
   * is the asker's HOME state and is the same for every child row of a
   * given question. Excludes the canonical reference doc (`distributionState:
   * null`, `isReference: true`) since it isn't a distribution to any state.
   */
  countByDistributionState(): Promise<Array<{ state: string; count: number }>>;
}