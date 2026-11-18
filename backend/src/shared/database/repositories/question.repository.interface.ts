import { BaseRepository } from '../abstractions/base.repository';
// import { Question } from '../entities';
import { QuestionStatus } from '../../classes/enums';
import { MongoRepository } from '../abstractions/mongo.repository';
import { ListQuestionsDto } from '@/modules/question/dto';
import { ListReviewQueueDto } from '@/modules/admin/dto/review-question.dto';
import { Question } from '../mongodb/schemas/question.schema';

/**
 * Fields returned to the frontend for a single question. Matches the frontend
 * `Question` contract; excludes heavy/internal fields such as `embedding`,
 * `deviceInfo`, `duplicateOfId` and soft-delete flags.
 */
export const QUESTION_RESPONSE_SELECT: string[] = [
  'id',
  'userId',
  'questionText',
  'status',
  'domains',
  'season',
  'cropType',
  'state',
  'district',
  'block',
  'language',
  'mediaType',
  'mediaUrls',
  'audioUrls',
  'duplicateFlag',
  'submissionLocation',
  'isAnveshan',
  'isAnswerSubmitted',
  'submittedAt',
  'reviewedAt',
  'reviewerId',
  'rejectionReason',
  'approvalReason',
  'heldReason',
  'createdAt',
  'updatedAt',
];

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

/** Duplicate-flagged question joined with its submitter, used by the fraud view. */
export interface DuplicateSubmissionRow {
  id: string;
  questionText: string;
  state?: string;
  submittedAt: Date;
  userId: string;
  userName?: string;
  mobileNumber?: string;
}

/** Daily submission/decision volume row used by the curator dashboard chart. */
export interface DailyVolumeRow {
  date: string; // YYYY-MM-DD
  submitted: number;
  approved: number;
  rejected: number;
  held: number;
}

export interface QuestionAnalyticsFilters {
  from: Date;
  to: Date;
  state?: string;
  cropType?: string;
  /** Condition on the submitting user's id (staff dashboard scope). */
  userIdFilter?: Record<string, unknown>;
}

export interface QuestionAnalyticsResult {
  summary: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };

  dailyVolume: Array<{
    date: string;
    submitted: number;
    approved: number;
    rejected: number;
  }>;

  stateBreakdown: Array<{
    state: string;
    count: number;
    approved: number;
  }>;

  districtBreakdown: Array<{
    district: string;
    state: string;
    count: number;
    approved: number;
  }>;

  cropBreakdown: Array<{
    cropType: string;
    count: number;
    approved: number;
  }>;

  domainBreakdown: Array<{
    domain: string;
    count: number;
    approved: number;
  }>;
}

/** Per-user question totals used for Anveshan progress. */
export interface UserQuestionCounts {
  userId: string;
  questions: number;
  answers: number;
}

export interface IQuestionRepository extends MongoRepository<Question> {
  /** Question and submitted-answer counts for each of the given users (users with no questions are omitted). */
  countSubmissionsByUsers(userIds: string[]): Promise<UserQuestionCounts[]>;

  /** Ids of users with at least `minAnswers` answered questions. */
  findUserIdsWithAnswers(minAnswers: number): Promise<string[]>;

  findByUserId(userId: string, status?: QuestionStatus, limit?: number): Promise<Question[]>;
  countByUserId(userId: string, status?: QuestionStatus): Promise<number>;
  searchByText(text: string, limit?: number): Promise<Question[]>;
  findExactDuplicate(userId: string, questionText: string, state?: string, district?: string): Promise<Question | null>;

  /**
   * Returns the top N users ranked by their count of APPROVED questions.
   * Used by the leaderboard warmup.
   */
  getLeaderboard(limit: number): Promise<Array<{ userId: string; approvedCount: number }>>;

  // ─── Aggregations ──────────────────────────────────────────────────────────
  // Native aggregation pipelines behind the dashboard and metrics endpoints.

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
   * counts. Only days within `[from, to]` (or `[from, +∞)` without `to`) are
   * included, and days with zero questions are omitted (the UI handles gaps).
   */
  dailyVolumeSince(from: Date, to?: Date): Promise<DailyVolumeRow[]>;

  /**
   * Returns the most frequent values of a single string field (`cropType` or
   * `state`) among questions submitted on/after `from`, and on/before `to`
   * when given. Without `limit`, every value is returned.
   */
  topFieldSince(
    field: 'cropType' | 'state',
    from: Date,
    limit?: number,
    to?: Date,
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
   * statuses. The `[from, to]` window applies to `reviewedAt` by default, or to
   * `submittedAt` when `windowField` says so. Returns null when there is no
   * reviewed data in the window.
   */
  avgReviewTurnaroundMinutes(
  from: Date,
  to: Date,
  filter: Record<string, unknown>,
  statuses: QuestionStatus[],
  windowField?: 'reviewedAt' | 'submittedAt',
  ): Promise<number | null>;

  /** Duplicate-flagged questions with the submitter's name and mobile, newest first. */
  findDuplicatesWithSubmitter(params: {
    state?: string;
    page: number;
    limit: number;
  }): Promise<{ items: DuplicateSubmissionRow[]; total: number }>;

  avgReviewTurnaroundMinutesSince(
    from: Date,
    statuses: QuestionStatus[],
    userIdFilter?: Record<string, unknown>,
  ): Promise<number | null>;


  getQuestionAnalytics(
  filters: QuestionAnalyticsFilters,
): Promise<QuestionAnalyticsResult>;

getQuestionStats(userIdFilter?: Record<string, unknown>): Promise<{
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}>;

countSubmittedBetween(
  from: Date,
  to: Date,
  userIdFilter?: Record<string, unknown>,
): Promise<number>;

/** Number of distinct question `state` values with any of the given statuses, submitted within [from, to]. */
countDistinctStates(
  from: Date,
  to: Date,
  statuses: QuestionStatus[],
  userIdFilter?: Record<string, unknown>,
): Promise<number>;

getDailyStatsSince(from: Date, userIdFilter?: Record<string, unknown>): Promise<Array<{
  date: string;
  users: number;
  questions: number;
  approved: number;
  rejected: number;
}>>;

/** Flat rows (joined with submitter name/mobile) for CSV/Excel export. */
  findForExport(filters: { from: Date; to: Date; state?: string; cropType?: string }): Promise<Record<string, unknown>[]>;

  list(  
    userId: string,
    dto: ListQuestionsDto,
    isAdmin: boolean,
    canViewContact?: boolean,
  ): Promise<any>

  /** Review queue page with submitter details (pending and held unless a status is given). */
  listQueue(dto: ListReviewQueueDto): Promise<any>

  dailyVolume(
  from: Date,
  to: Date,
  filter: Record<string, unknown>,
): Promise<DailyVolumeRow[]>

topField(
  field: 'cropType' | 'state',
  from: Date,
  to: Date,
  filter: Record<string, unknown>,
  limit: number,
): Promise<Array<{ key: string; count: number }>>

topDomains(
  from: Date,
  to: Date,
  filter: Record<string, unknown>,
  limit: number,
): Promise<Array<{ domain: string; count: number }>>
}
