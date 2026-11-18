import {
  countAnveshanAnswers,
  evaluateAnveshanProgress,
  findAnveshanAnswerableQuestions,
  getAnveshanRequirements,
  toStepTimeline,
  type AnveshanCounts,
} from '../../../../src/shared/utils/anveshan.util';
import type { IQuestionRepository } from '../../../../src/shared/database/repositories';
import type { Question } from '../../../../src/shared/database/mongodb/schemas/question.schema';

// Outside production the question target is 5 and the answer target is 2.
const zero: AnveshanCounts = { questions: 0, crop: 0, weed: 0, pest: 0, disease: 0, answers: 0 };
const submissionsDone: AnveshanCounts = { questions: 5, crop: 1, weed: 1, pest: 1, disease: 1, answers: 0 };

describe('anveshan.util', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('getAnveshanRequirements', () => {
    it('uses the reduced question target outside production', () => {
      expect(getAnveshanRequirements()).toEqual({ questions: 5, crop: 1, weed: 1, pest: 1, disease: 1, answers: 2 });
    });

    it('requires 25 questions in production', () => {
      process.env.NODE_ENV = 'production';

      expect(getAnveshanRequirements().questions).toBe(25);
    });
  });

  describe('evaluateAnveshanProgress', () => {
    it('reports 0% with nothing done', () => {
      expect(evaluateAnveshanProgress(zero)).toEqual(
        expect.objectContaining({ percent: 0, submissionsCompleted: false, completed: false }),
      );
    });

    it('weighs submissions at 80% once every submission goal is met', () => {
      const result = evaluateAnveshanProgress(submissionsDone);

      expect(result.percent).toBe(80);
      expect(result.submissionsCompleted).toBe(true);
      expect(result.completed).toBe(false);
    });

    it('adds answers on top of completed submissions', () => {
      expect(evaluateAnveshanProgress({ ...submissionsDone, answers: 1 }).percent).toBe(90);
      expect(evaluateAnveshanProgress({ ...submissionsDone, answers: 2 })).toEqual(
        expect.objectContaining({ percent: 100, completed: true }),
      );
    });

    it('ignores answers until submissions are complete', () => {
      const result = evaluateAnveshanProgress({ ...zero, questions: 5, answers: 2 });

      expect(result.submissionsCompleted).toBe(false);
      expect(result.percent).toBe(Math.round((5 / 9) * 80));
    });

    it('caps progress at each requirement so extra submissions never exceed 100%', () => {
      const result = evaluateAnveshanProgress({ questions: 40, crop: 9, weed: 9, pest: 9, disease: 9, answers: 9 });

      expect(result.progress).toEqual(result.requirements);
      expect(result.percent).toBe(100);
    });

    it('stays incomplete while any single entity type is missing', () => {
      expect(evaluateAnveshanProgress({ ...submissionsDone, disease: 0, answers: 2 }).completed).toBe(false);
    });
  });

  describe('toStepTimeline', () => {
    const d = (iso: string) => new Date(iso);

    it('returns nulls when nothing was submitted', () => {
      expect(toStepTimeline([], 3)).toEqual({ startedAt: null, completedAt: null });
    });

    it('sorts dates and uses the earliest as the start', () => {
      const result = toStepTimeline([d('2026-03-03'), d('2026-03-01'), d('2026-03-02')], 5);

      expect(result).toEqual({ startedAt: d('2026-03-01'), completedAt: null });
    });

    it('marks completion at the submission that reached the target', () => {
      const result = toStepTimeline([d('2026-03-04'), d('2026-03-01'), d('2026-03-02'), d('2026-03-03')], 3);

      expect(result.completedAt).toEqual(d('2026-03-03'));
    });

    it('never completes a goal with no requirement', () => {
      expect(toStepTimeline([d('2026-03-01')], 0).completedAt).toBeNull();
    });
  });

  describe('countAnveshanAnswers', () => {
    it('counts questions flagged as answered', () => {
      const questions = [{ isAnswerSubmitted: true }, { isAnswerSubmitted: false }, { isAnswerSubmitted: true }];

      expect(countAnveshanAnswers(questions as Question[])).toBe(2);
    });
  });

  describe('findAnveshanAnswerableQuestions', () => {
    it("fetches the user's earliest questions up to the target count", async () => {
      const questionRepo = { find: jest.fn().mockResolvedValue([]) };

      await findAnveshanAnswerableQuestions(questionRepo as unknown as IQuestionRepository, 'user-1');

      expect(questionRepo.find).toHaveBeenCalledWith(
        { userId: 'user-1' },
        { pagination: { page: 1, limit: 5, sort: { submittedAt: 1 } } },
      );
    });
  });
});
