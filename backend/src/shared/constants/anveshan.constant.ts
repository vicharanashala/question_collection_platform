import { isProduction } from '../../config/environment';

// Anveshan question target: 25 in production, 5 in development and staging for easier testing.
export function getAnveshanRequiredQuestionCount(): number {
  return isProduction() ? 25 : 5;
}

// Number of their own submitted questions an Anveshan user must answer after the submission goals are met.
export const ANVESHAN_REQUIRED_ANSWER_COUNT = 2;
