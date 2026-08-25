import { BaseRepository } from '../abstractions/base.repository';
import { Question } from '../entities';
import { QuestionStatus } from '../../classes/enums';

export interface QuestionFilter {
  id?: string;
  userId?: string;
  status?: QuestionStatus;
  questionText?: string;
  cropType?: string;
  season?: string;
  state?: string;
  district?: string;
  domains?: string[];
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
}

/** Daily submission/decision volume row used by the curator dashboard chart. */
export interface DailyVolumeRow {
  date: string; // YYYY-MM-DD
  submitted: number;
  approved: number;
  rejected: number;
  held: number;
}

export interface IQuestionRepository extends BaseRepository<Question> {
  findByUserId(userId: string, status?: QuestionStatus, limit?: number): Promise<Question[]>;
  countByUserId(userId: string, status?: QuestionStatus): Promise<number>;
  searchByText(text: string, limit?: number): Promise<Question[]>;
  findExactDuplicate(userId: string, questionText: string, state: string, district: string): Promise<Question | null>;

  /**
   * Returns the top N users ranked by their count of APPROVED questions.
   * Used by the leaderboard warmup.
   * - Postgres: uses createQueryBuilder GROUP BY + COUNT
   * - MongoDB:  uses an aggregation pipeline ($match → $group → $sort → $limit)
   */
  getLeaderboard(limit: number): Promise<Array<{ userId: string; approvedCount: number }>>;

  // ─── Aggregations ──────────────────────────────────────────────────────────
  // The curator dashboard relies on real GROUP BY / aggregation queries, which
  // the chainable MongoQueryBuilder does not implement (addSelect/groupBy are
  // explicit no-ops — see MongoQueryBuilder.addSelect). These dedicated methods
  // run native Mongoose aggregation pipelines that work in MongoDB.

  /**
   * Counts questions per status, restricted to the given statuses. Used to
   * render the curator "Queue by status" breakdown.
   * Returns one row per status that has at least one question (statuses with
   * zero count are omitted so the caller can default them if desired).
   */
  countByStatuses(
    statuses: QuestionStatus[],
  ): Promise<Array<{ status: QuestionStatus; count: number }>>;

  /**
   * Returns one row per calendar day with submitted/approved/rejected/held
   * counts. Only days that fall within `[from, +∞)` are included, and days
   * with zero questions are omitted (chart-friendly; the UI handles gaps).
   */
  dailyVolumeSince(from: Date): Promise<DailyVolumeRow[]>;

  /**
   * Returns the top-N most frequent values of a single string field
   * (`cropType` or `state`) among questions submitted on/after `from`.
   */
  topFieldSince(
    field: 'cropType' | 'state',
    from: Date,
    limit: number,
  ): Promise<Array<{ key: string; count: number }>>;

  /**
   * Returns the top-N most frequent values inside the `domains` array column.
   * Unwinds the array, then counts occurrences across all questions.
   */
  topDomainsSince(
    from: Date,
    limit: number,
  ): Promise<Array<{ domain: string; count: number }>>;

  /**
   * Average review turnaround (in minutes) for questions with the given
   * statuses that were reviewed on/after `from`. Returns null when there is
   * no reviewed data in the window.
   */
  avgReviewTurnaroundMinutesSince(
    from: Date,
    statuses: QuestionStatus[],
  ): Promise<number | null>;
}