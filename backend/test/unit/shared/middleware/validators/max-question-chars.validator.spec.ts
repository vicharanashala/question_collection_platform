import type { INestApplication } from '@nestjs/common';
import type { ValidationArguments } from 'class-validator';
import { MaxQuestionCharsConstraint } from '../../../../../src/shared/middleware/validators/max-question-chars.validator';

describe('MaxQuestionCharsConstraint', () => {
  const constraint = new MaxQuestionCharsConstraint();
  const args = {} as ValidationArguments;

  afterEach(() => {
    globalThis.nestApp = undefined;
  });

  // Publishes a fake app whose AdminService returns the given limit, as main.ts does with the real app.
  const withConfiguredLimit = (getConfigValue: jest.Mock) => {
    globalThis.nestApp = { get: () => ({ getConfigValue }) } as unknown as INestApplication;
  };

  it('leaves null and non-string values to the other validators', async () => {
    await expect(constraint.validate(null as unknown as string, args)).resolves.toBe(true);
    await expect(constraint.validate(42 as unknown as string, args)).resolves.toBe(true);
  });

  it('falls back to 1000 characters before the app has booted', async () => {
    await expect(constraint.validate('a'.repeat(1000), args)).resolves.toBe(true);
    await expect(constraint.validate('a'.repeat(1001), args)).resolves.toBe(false);
  });

  it('enforces the limit configured by admins', async () => {
    const getConfigValue = jest.fn().mockResolvedValue(20);
    withConfiguredLimit(getConfigValue);

    await expect(constraint.validate('a'.repeat(20), args)).resolves.toBe(true);
    await expect(constraint.validate('a'.repeat(21), args)).resolves.toBe(false);
    expect(getConfigValue).toHaveBeenCalledWith('max_question_chars');
  });

  it('falls back to 1000 characters when reading the config fails', async () => {
    withConfiguredLimit(jest.fn().mockRejectedValue(new Error('db down')));

    await expect(constraint.validate('a'.repeat(1000), args)).resolves.toBe(true);
    await expect(constraint.validate('a'.repeat(1001), args)).resolves.toBe(false);
  });
});
