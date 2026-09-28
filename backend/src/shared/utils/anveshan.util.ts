import type { IQuestionRepository } from '../database/repositories';
import type { Question } from '../database/entities';
import { getAnveshanRequiredQuestionCount } from '../constants/anveshan.constant';

// Returns the user's earliest submissions up to the required question count; these are the ones they answer.
export function findAnveshanAnswerableQuestions(questionRepo: IQuestionRepository, userId: string): Promise<Question[]> {
  return questionRepo.find(
    { userId },
    { pagination: { page: 1, limit: getAnveshanRequiredQuestionCount(), sort: { submittedAt: 1 } } },
  );
}

// Number of answerable questions the user has already answered.
export function countAnveshanAnswers(questions: Question[]): number {
  return questions.filter((question) => question.anveshanAnswer).length;
}
