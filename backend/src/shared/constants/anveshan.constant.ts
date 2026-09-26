import { isProduction } from '../../config/environment';

// Anveshan question target: 25 in production, 5 in development and staging for easier testing.
export function getAnveshanRequiredQuestionCount(): number {
  return isProduction() ? 25 : 5;
}
