export type AnveshanAnswerSourceType = 'hyper_local' | 'state' | 'central' | 'other';

/** One supporting reference for an Anveshan answer. */
export interface AnveshanAnswerSource {
  sourceType: AnveshanAnswerSourceType;
  sourceName: string;
  source: string;
  page: string | null;
}

/** processing: job sent to the scoring service; failed: the job could not be started or the service reported a failure. */
export type AnveshanAnswerScoreStatus = 'processing' | 'completed' | 'failed';

/** One rule the scoring service evaluated for an answer. */
export interface AnveshanAnswerScoreCheck {
  parameter: string;
  category: string;
  /** PASS, FAIL or NOT_EVALUATED. */
  result: string;
  /** Null when the check was not evaluated. */
  mark: number | null;
  reason: string;
}

/** System score for an answer, filled in once the scoring job completes. */
export interface AnveshanAnswerScore {
  jobId: string | null;
  status: AnveshanAnswerScoreStatus;
  systemScore: number | null;
  maxScore: number | null;
  percentage: number | null;
  needsHumanReview: boolean | null;
  reviewReasons: string[];
  checks: AnveshanAnswerScoreCheck[];
  notApplicable: string[];
  notEvaluated: string[];
  checkedAt: Date | null;
  requestedAt: Date;
  /** Full job response from the scoring service, kept as received for audit and reprocessing. Not sent to clients. */
  response: Record<string, unknown> | null;
}

/**
 * Answer an Anveshan user writes for one of their own submitted questions.
 * Stored in `anveshan_answers`, one document per question (unique `questionId`).
 */
export class AnveshanAnswer {
  id: string;
  questionId: string;
  userId: string;
  answer: string;
  sources: AnveshanAnswerSource[];
  remarks: string | null;
  answeredAt: Date;
  /** Null for answers submitted before scoring was introduced. */
  score: AnveshanAnswerScore | null;
  createdAt: Date;
  updatedAt: Date;
}
