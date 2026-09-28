export type AnveshanAnswerSourceType = 'hyper_local' | 'state' | 'central' | 'other';

/** One supporting reference for an Anveshan answer. */
export interface AnveshanAnswerSource {
  sourceType: AnveshanAnswerSourceType;
  sourceName: string;
  source: string;
  page: string | null;
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
  createdAt: Date;
  updatedAt: Date;
}
