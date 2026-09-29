import type { IQuestionRepository } from '../database/repositories';
import type { Question } from '../database/entities';
import { ANVESHAN_REQUIRED_ANSWER_COUNT, getAnveshanRequiredQuestionCount } from '../constants/anveshan.constant';

// Returns the user's earliest submissions up to the required question count; these are the ones they answer.
export function findAnveshanAnswerableQuestions(questionRepo: IQuestionRepository, userId: string): Promise<Question[]> {
  return questionRepo.find(
    { userId },
    { pagination: { page: 1, limit: getAnveshanRequiredQuestionCount(), sort: { submittedAt: 1 } } },
  );
}

// Number of answerable questions the user has already answered, read from the question flag.
export function countAnveshanAnswers(questions: Question[]): number {
  return questions.filter((question) => question.isAnswerSubmitted).length;
}

export interface AnveshanCounts {
  questions: number;
  crop: number;
  weed: number;
  pest: number;
  disease: number;
  answers: number;
}

export interface AnveshanProgress {
  requirements: AnveshanCounts;
  /** Counts capped at their requirement. */
  progress: AnveshanCounts;
  /** Question and crop/weed/pest/disease goals are met, which unlocks answering. */
  submissionsCompleted: boolean;
  /** Every goal, including answers, is met. */
  completed: boolean;
  /** Overall percentage: submissions weigh 80, answers 20 (answers count only once submissions are done). */
  percent: number;
}

/** When a goal was started (first submission) and completed (the submission that met the requirement). */
export interface AnveshanStepTimeline {
  startedAt: Date | null;
  completedAt: Date | null;
}

export type AnveshanTimeline = Record<keyof AnveshanCounts, AnveshanStepTimeline>;

// Start is the earliest submission; completion is the one that reached the required count, if it has.
export function toStepTimeline(dates: Date[], required: number): AnveshanStepTimeline {
  const sorted = dates.map((date) => new Date(date)).sort((a, b) => a.getTime() - b.getTime());
  return {
    startedAt: sorted[0] ?? null,
    completedAt: required > 0 && sorted.length >= required ? sorted[required - 1] : null,
  };
}

const SUBMISSION_KEYS = ['questions', 'crop', 'weed', 'pest', 'disease'] as const;
const SUBMISSION_WEIGHT = 80;

// Targets for every Anveshan goal in the current environment.
export function getAnveshanRequirements(): AnveshanCounts {
  return {
    questions: getAnveshanRequiredQuestionCount(),
    crop: 1,
    weed: 1,
    pest: 1,
    disease: 1,
    answers: ANVESHAN_REQUIRED_ANSWER_COUNT,
  };
}

// Turns raw counts into capped progress, completion flags and the overall percentage.
export function evaluateAnveshanProgress(actual: AnveshanCounts): AnveshanProgress {
  const requirements = getAnveshanRequirements();
  const keys = Object.keys(requirements) as (keyof AnveshanCounts)[];
  const progress = Object.fromEntries(
    keys.map((key) => [key, Math.min(actual[key], requirements[key])]),
  ) as unknown as AnveshanCounts;

  const submissionsCompleted = SUBMISSION_KEYS.every((key) => actual[key] >= requirements[key]);
  const completed = submissionsCompleted && actual.answers >= requirements.answers;

  const submissionRequired = SUBMISSION_KEYS.reduce((sum, key) => sum + requirements[key], 0);
  const submissionDone = SUBMISSION_KEYS.reduce((sum, key) => sum + progress[key], 0);
  const answerShare = requirements.answers === 0 ? 1 : progress.answers / requirements.answers;
  const percent = Math.round(
    (submissionDone / submissionRequired) * SUBMISSION_WEIGHT +
      (submissionsCompleted ? answerShare * (100 - SUBMISSION_WEIGHT) : 0),
  );

  return { requirements, progress, submissionsCompleted, completed, percent };
}
