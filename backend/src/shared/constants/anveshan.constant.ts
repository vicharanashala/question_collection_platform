import { isProduction } from '../../config/environment';

// Anveshan question target: 25 in production, 5 in development and staging for easier testing.
export function getAnveshanRequiredQuestionCount(): number {
  return isProduction() ? 25 : 5;
}

// Number of their own submitted questions an Anveshan user must answer after the submission goals are met.
export const ANVESHAN_REQUIRED_ANSWER_COUNT = 2;

// A scoring job still processing after this long is treated as lost and started again. Jobs normally take about 4 minutes.
export const ANVESHAN_SCORE_JOB_STALE_AFTER_MS = 15 * 60 * 1000;

// How often the backend checks scoring jobs that are still processing.
export const ANVESHAN_SCORE_POLL_INTERVAL_MS = 60 * 1000;
