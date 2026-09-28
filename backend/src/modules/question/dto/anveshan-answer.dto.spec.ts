import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { MIN_ANVESHAN_ANSWER_LENGTH, SubmitAnveshanAnswerDto } from './anveshan-answer.dto';

const source = { sourceType: 'state', sourceName: 'KAU', source: 'https://kau.in/pop.pdf', page: '12' };

// Returns the property names that fail validation for the given body.
const failingFields = (body: object) =>
  validateSync(plainToInstance(SubmitAnveshanAnswerDto, body)).map((error) => error.property);

describe('SubmitAnveshanAnswerDto', () => {
  it(`rejects answers shorter than ${MIN_ANVESHAN_ANSWER_LENGTH} characters after trimming`, () => {
    const answer = `  ${'a'.repeat(MIN_ANVESHAN_ANSWER_LENGTH - 1)}  `;
    expect(failingFields({ answer, sources: [source] })).toContain('answer');
  });

  it(`accepts an answer of exactly ${MIN_ANVESHAN_ANSWER_LENGTH} characters with a source`, () => {
    expect(failingFields({ answer: 'a'.repeat(MIN_ANVESHAN_ANSWER_LENGTH), sources: [source] })).toEqual([]);
  });
});
